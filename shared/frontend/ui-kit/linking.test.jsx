/**
 * The link the design system's own links are drawn with.
 *
 * A back link or breadcrumb that renders a plain anchor inside the shell
 * reloads the whole page -- sidebar, providers and all -- so the provided
 * router link is the thing worth pinning down.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import BackLink from "./components/BackLink";
import Breadcrumbs from "./components/Breadcrumbs";
import { LinkComponentProvider } from "./linking";

function RouterLink({ to, children, ...rest }) {
  return (
    <a href={to} data-router-link="" {...rest}>
      {children}
    </a>
  );
}

function ExplicitLink({ to, children, ...rest }) {
  return (
    <a href={to} data-explicit-link="" {...rest}>
      {children}
    </a>
  );
}

describe("LinkComponentProvider", () => {
  it("is what a back link is drawn with", () => {
    render(
      <LinkComponentProvider value={RouterLink}>
        <BackLink to="/administration/addons" label="Back to add-ons" />
      </LinkComponentProvider>
    );

    expect(screen.getByRole("link", { name: "Back to add-ons" })).toHaveAttribute("data-router-link");
  });

  it("is what a breadcrumb trail is drawn with", () => {
    render(
      <LinkComponentProvider value={RouterLink}>
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Sales" }]} />
      </LinkComponentProvider>
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("data-router-link");
  });

  it("gives way to a link component passed explicitly", () => {
    render(
      <LinkComponentProvider value={RouterLink}>
        <BackLink to="/" label="Back" linkComponent={ExplicitLink} />
      </LinkComponentProvider>
    );

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("data-explicit-link");
  });

  it("leaves a plain anchor outside any provider", () => {
    render(<BackLink to="/" label="Back" />);

    const link = screen.getByRole("link", { name: "Back" });
    expect(link).not.toHaveAttribute("data-router-link");
    expect(link).toHaveAttribute("href", "/");
  });
});
