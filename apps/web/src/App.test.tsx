import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "./App";

test("hero states the value proposition", () => {
  render(<App />);
  expect(screen.getByText(/Teach your AI once/i)).toBeInTheDocument();
});

test("shows the npx install command", () => {
  render(<App />);
  expect(screen.getAllByText(/npx -y @tlgimenes\/recall/).length).toBeGreaterThan(0);
});

test("tells the cross-agent story", () => {
  render(<App />);
  expect(screen.getByText(/already follows your convention/i)).toBeInTheDocument();
});
