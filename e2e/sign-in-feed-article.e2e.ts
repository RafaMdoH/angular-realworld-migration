import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Critical user flow against a fully mocked RealWorld API:
 * sign in -> "Your Feed" lists the user's feed -> open an article.
 *
 * Known inherited bug (locked, see home.component.spec.ts): after sign-in the
 * home page keeps the global list instead of switching to "Your Feed", because
 * HomeComponent calls setListTo("feed") before it stores isAuthenticated. The
 * flow therefore clicks "Your Feed" explicitly, as a real user would have to.
 *
 * The public RealWorld API (https://api.realworld.io) no longer exists, so
 * every API call is answered from the fixtures below. Any API call without a
 * fixture is answered with HTTP 500 and recorded, and the test fails on it.
 * Every request to a host other than the dev server (theme stylesheet, fonts,
 * icons) is aborted so dead third-party hosts cannot slow the test down.
 */

const API_BASE = "https://api.realworld.io/api";
const APP_ORIGIN = "http://localhost:4200";

const credentials = { email: "jane@example.com", password: "s3cret-pass" };

const user = {
  email: credentials.email,
  token: "e2e-mock-jwt-token",
  username: "jane",
  bio: "Mocked user for the end-to-end flow",
  image: "",
};

const author = {
  username: "john",
  bio: "Mocked author",
  image: "",
  following: true,
};

const feedArticle = {
  slug: "mocked-feed-article",
  title: "Migrating Angular without breaking users",
  description: "A mocked article served only by the e2e fixtures",
  body: "This **mocked body** proves the article page renders markdown.",
  tagList: ["angular", "migration"],
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  favorited: false,
  favoritesCount: 3,
  author,
};

const secondFeedArticle = {
  ...feedArticle,
  slug: "second-mocked-article",
  title: "Zoneless change detection in practice",
  description: "Second mocked feed entry",
  favoritesCount: 0,
};

const globalArticle = {
  ...feedArticle,
  slug: "global-mocked-article",
  title: "An article from the global list",
  description: "Only served by GET /articles (global list)",
  favoritesCount: 0,
};

const comments = [
  {
    id: "1",
    body: "First mocked comment on the article.",
    createdAt: "2026-11-02T08:00:00.000Z",
    author: { ...author, username: "alice" },
  },
];

type Handler = (route: Route) => Promise<void>;

const json = (body: unknown, status = 200): Handler => {
  return (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
};

/** Fixtures keyed by "METHOD /path" (path relative to API_BASE, no query). */
const apiFixtures: Record<string, Handler> = {
  "POST /users/login": async (route) => {
    expect(route.request().postDataJSON()).toEqual({ user: credentials });
    await json({ user })(route);
  },
  "GET /user": json({ user }),
  "GET /tags": json({ tags: ["angular", "migration"] }),
  "GET /articles": json({ articles: [globalArticle], articlesCount: 1 }),
  "GET /articles/feed": json({
    articles: [feedArticle, secondFeedArticle],
    articlesCount: 2,
  }),
  [`GET /articles/${feedArticle.slug}`]: json({ article: feedArticle }),
  [`GET /articles/${feedArticle.slug}/comments`]: json({ comments }),
};

interface ApiLog {
  handled: { key: string; authorization: string | null }[];
  unmocked: string[];
}

async function mockNetwork(page: Page): Promise<ApiLog> {
  const log: ApiLog = { handled: [], unmocked: [] };

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin === APP_ORIGIN) {
      return route.continue();
    }

    if (request.url().startsWith(API_BASE)) {
      const path = url.pathname.slice(new URL(API_BASE).pathname.length);
      const key = `${request.method()} ${path}`;
      const handler = apiFixtures[key];
      if (!handler) {
        log.unmocked.push(`${key}${url.search}`);
        return route.fulfill({
          status: 500,
          body: `Unmocked API call: ${key}`,
        });
      }
      log.handled.push({
        key,
        authorization: request.headers()["authorization"] ?? null,
      });
      return handler(route);
    }

    // Dead theme stylesheet, fonts and icon CDN: never reach the network.
    return route.abort("blockedbyclient");
  });

  return log;
}

test("sign in, see the feed and open an article (mocked API)", async ({
  page,
}) => {
  const api = await mockNetwork(page);

  await test.step("sign in with mocked credentials", async () => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { level: 1, name: "Sign in" })
    ).toBeVisible();

    await page.getByPlaceholder("Email").fill(credentials.email);
    await page.getByPlaceholder("Password").fill(credentials.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(`${APP_ORIGIN}/`);
    await expect(
      page.getByRole("link", { name: user.username, exact: true })
    ).toBeVisible();
    expect(
      await page.evaluate(() => window.localStorage.getItem("jwtToken"))
    ).toBe(user.token);
  });

  await test.step("home shows the mocked articles in Your Feed", async () => {
    // The feed tabs are <a> elements without href, so they have no link role.
    const yourFeedTab = page.getByText("Your Feed", { exact: true });
    const globalFeedTab = page.getByText("Global Feed", { exact: true });

    // Locked bug: the signed-in user first lands on the global list.
    await expect(globalFeedTab).toHaveClass(/active/);
    await expect(
      page.getByRole("heading", { name: globalArticle.title })
    ).toBeVisible();

    await yourFeedTab.click();

    await expect(yourFeedTab).toHaveClass(/active/);
    await expect(
      page.getByRole("heading", { name: feedArticle.title })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: secondFeedArticle.title })
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: globalArticle.title })
    ).toHaveCount(0);

    const feedCall = api.handled.find((c) => c.key === "GET /articles/feed");
    expect(feedCall?.authorization).toBe(`Token ${user.token}`);
  });

  await test.step("open an article and see its content", async () => {
    await page.getByRole("heading", { name: feedArticle.title }).click();

    await expect(page).toHaveURL(`${APP_ORIGIN}/article/${feedArticle.slug}`);
    await expect(
      page.getByRole("heading", { level: 1, name: feedArticle.title })
    ).toBeVisible();
    await expect(page.locator(".article-content strong")).toHaveText(
      "mocked body"
    );
    await expect(page.getByText(comments[0].body)).toBeVisible();
  });

  expect(api.unmocked, "every API call must have a fixture").toEqual([]);
});
