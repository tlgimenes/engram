import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "./App";

test("hero states the value proposition", () => {
  render(<App />);
  expect(screen.getByText(/Teach your AI once/i)).toBeInTheDocument();
});

test("shows a working build-from-source install command", () => {
  render(<App />);
  expect(screen.getAllByText(/cargo build/).length).toBeGreaterThan(0);
});

test("marks the npx install command as not yet live", () => {
  render(<App />);
  expect(screen.getAllByText(/npx -y @tlgimenes\/recall/).length).toBeGreaterThan(0);
  expect(screen.getByText(/hasn't cut its first public release yet/i)).toBeInTheDocument();
});

test("tells the cross-agent story", () => {
  render(<App />);
  expect(screen.getByText(/already follows your convention/i)).toBeInTheDocument();
});
