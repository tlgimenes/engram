use agent_cli::AgentProvider;
use anyhow::{anyhow, Result};
use serde_json::{json, Value};

#[derive(Debug, Clone, PartialEq)]
pub enum ScopeHint {
    Global,
    Language(String),
    Repo,
    Branch,
}

#[derive(Debug, Clone)]
pub struct Candidate {
    pub rule: String,
    pub scope_hint: ScopeHint,
    pub tags: Vec<String>,
    pub rationale: Option<String>,
    pub excerpt: Option<String>,
}

/// JSON schema the provider must satisfy.
pub fn extraction_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "conventions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "rule": { "type": "string" },
                        "scope": { "type": "string", "description": "global | repo | branch | language:<lang>" },
                        "tags": { "type": "array", "items": { "type": "string" } },
                        "rationale": { "type": "string" },
                        "excerpt": { "type": "string" }
                    },
                    "required": ["rule", "scope"]
                }
            }
        },
        "required": ["conventions"]
    })
}

pub fn extraction_prompt(transcript: &str) -> String {
    format!(
        "You extract DURABLE, PERSONAL coding conventions a developer expressed or \
         corrected in this agent session. Ignore one-off task details. For each, give \
         an imperative rule under 140 chars, a scope (global | repo | branch | \
         language:<lang>), optional tags, and the short excerpt it came from. Return \
         JSON matching the schema. If none, return an empty array.\n\n\
         === SESSION TRANSCRIPT ===\n{transcript}"
    )
}

fn scope_hint_from_str(s: &str) -> ScopeHint {
    if let Some(lang) = s.strip_prefix("language:") {
        return ScopeHint::Language(lang.to_string());
    }
    match s {
        "repo" => ScopeHint::Repo,
        "branch" => ScopeHint::Branch,
        _ => ScopeHint::Global,
    }
}

pub fn parse_candidates(v: &Value) -> Result<Vec<Candidate>> {
    let arr = v
        .get("conventions")
        .and_then(|c| c.as_array())
        .ok_or_else(|| anyhow!("missing 'conventions' array"))?;
    let mut out = Vec::new();
    for item in arr {
        // Skip malformed entries (missing 'rule' field), continue to next item
        let rule = match item.get("rule").and_then(|r| r.as_str()) {
            Some(r) => r.to_string(),
            None => continue,
        };
        let scope_hint = scope_hint_from_str(
            item.get("scope")
                .and_then(|s| s.as_str())
                .unwrap_or("global"),
        );
        let tags = item
            .get("tags")
            .and_then(|t| t.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|x| x.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();
        let rationale = item
            .get("rationale")
            .and_then(|r| r.as_str())
            .map(String::from);
        let excerpt = item
            .get("excerpt")
            .and_then(|e| e.as_str())
            .map(String::from);
        out.push(Candidate {
            rule,
            scope_hint,
            tags,
            rationale,
            excerpt,
        });
    }
    Ok(out)
}

/// Run the extraction prompt through the provider and parse the result.
pub async fn extract(transcript: &str, provider: &dyn AgentProvider) -> Result<Vec<Candidate>> {
    let schema = extraction_schema();
    let raw = provider
        .complete_json(&extraction_prompt(transcript), &schema)
        .await?;
    parse_candidates(&raw)
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_cli::MockProvider;
    use serde_json::json;

    #[test]
    fn parse_candidates_reads_rules_array() {
        let v = json!({"conventions":[
            {"rule":"Import directly; no barrel files","scope":"global","tags":["imports"],"excerpt":"no barrels"}
        ]});
        let cands = parse_candidates(&v).unwrap();
        assert_eq!(cands.len(), 1);
        assert_eq!(cands[0].rule, "Import directly; no barrel files");
        assert!(matches!(cands[0].scope_hint, ScopeHint::Global));
        assert_eq!(cands[0].tags, vec!["imports".to_string()]);
    }

    #[test]
    fn parse_candidates_maps_language_scope() {
        let v =
            json!({"conventions":[{"rule":"Use ? over unwrap","scope":"language:rust","tags":[]}]});
        let cands = parse_candidates(&v).unwrap();
        assert!(matches!(&cands[0].scope_hint, ScopeHint::Language(l) if l == "rust"));
    }

    #[tokio::test]
    async fn extract_runs_provider_and_parses() {
        let provider = MockProvider::new(json!({"conventions":[
            {"rule":"Prefer early returns","scope":"global","tags":[]}
        ]}));
        let cands = extract("user: prefer early returns please", &provider)
            .await
            .unwrap();
        assert_eq!(cands.len(), 1);
        assert_eq!(cands[0].rule, "Prefer early returns");
    }

    #[test]
    fn parse_candidates_skips_malformed_entries_and_keeps_valid_ones() {
        // Mixed array: one well-formed entry, one missing 'rule' field
        let v = json!({"conventions":[
            {"rule":"Valid rule here","scope":"global","tags":[]},
            {"scope":"global","tags":[]},  // Missing 'rule' - should be skipped
            {"rule":"Another valid rule","scope":"repo","tags":["test"]}
        ]});
        let cands = parse_candidates(&v).unwrap();
        // Should have 2 valid candidates, malformed one skipped
        assert_eq!(cands.len(), 2);
        assert_eq!(cands[0].rule, "Valid rule here");
        assert_eq!(cands[1].rule, "Another valid rule");
        assert!(matches!(cands[1].scope_hint, ScopeHint::Repo));
    }
}
