import type { MockedObject } from "vitest";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { Observable, Subject, of } from "rxjs";
import { Article } from "../../core/models/article.model";
import { ArticleListConfig } from "../../core/models/article-list-config.model";
import { ArticlesService } from "../../core/services/articles.service";
import { UserService } from "../../core/services/user.service";
import { ArticleListComponent } from "./article-list.component";

type Page = {
  articles: Article[];
  articlesCount: number;
};

describe("ArticleListComponent (characterization)", () => {
  const article = (slug: string): Article => ({
    slug,
    title: `Title ${slug}`,
    description: "",
    body: "",
    tagList: [],
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
    favorited: false,
    favoritesCount: 0,
    author: { username: "alice", bio: "", image: "", following: false },
  });
  const config = (): ArticleListConfig => ({ type: "all", filters: {} });

  let articles: MockedObject<ArticlesService>;
  let fixture: ComponentFixture<ArticleListComponent>;

  const el = (): HTMLElement => fixture.nativeElement;
  const previewTitles = (): string[] =>
    Array.from(el().querySelectorAll("app-article-preview h1")).map((h) =>
      h.textContent!.trim()
    );
  const messages = (): string[] =>
    Array.from(el().querySelectorAll(":scope > div.article-preview")).map((d) =>
      d.textContent!.trim()
    );
  const pageItems = (): HTMLLIElement[] =>
    Array.from(el().querySelectorAll("nav ul.pagination li.page-item"));

  function create(response: Observable<Page>, limit = 10): void {
    articles.query.mockReturnValue(response);
    fixture = TestBed.createComponent(ArticleListComponent);
    fixture.componentRef.setInput("limit", limit);
    fixture.componentRef.setInput("config", config());
    fixture.detectChanges();
  }

  beforeEach(() => {
    articles = {
      query: vi.fn().mockName("ArticlesService.query"),
    } as unknown as MockedObject<ArticlesService>;
    TestBed.configureTestingModule({
      imports: [ArticleListComponent],
      providers: [
        provideRouter([]),
        { provide: ArticlesService, useValue: articles },
        { provide: UserService, useValue: {} },
      ],
    });
  });

  it("renders nothing before a config is set (NOT_LOADED)", () => {
    fixture = TestBed.createComponent(ArticleListComponent);
    fixture.detectChanges();

    expect(el().querySelectorAll("app-article-preview").length).toBe(0);
    expect(messages()).toEqual([]);
    expect(el().querySelector("nav")).toBeNull();
  });

  it("shows only the loading message while the query is pending", () => {
    create(new Subject<Page>());

    expect(messages()).toEqual(["Loading articles..."]);
    expect(el().querySelectorAll("app-article-preview").length).toBe(0);
    expect(el().querySelector("nav")).toBeNull();
  });

  it("renders one preview per article, in order, once loaded", () => {
    create(
      of({
        articles: [article("a"), article("b"), article("c")],
        articlesCount: 3,
      })
    );

    expect(previewTitles()).toEqual(["Title a", "Title b", "Title c"]);
    expect(messages()).toEqual([]);
    expect(el().querySelector("nav")).toBeNull();
  });

  it("shows the empty message when loaded with no articles", () => {
    create(of({ articles: [], articlesCount: 0 }));

    expect(messages()).toEqual(["No articles are here... yet."]);
    expect(el().querySelectorAll("app-article-preview").length).toBe(0);
    expect(el().querySelector("nav")).toBeNull();
  });

  it("renders one page button per page, marking the current page active", () => {
    create(of({ articles: [article("a")], articlesCount: 25 }));

    expect(pageItems().map((li) => li.textContent!.trim())).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(pageItems().map((li) => li.classList.contains("active"))).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("hides the pagination when there is exactly one page", () => {
    create(of({ articles: [article("a")], articlesCount: 10 }));

    expect(el().querySelector("nav")).toBeNull();
  });

  it("clicking a page button queries that page and moves the active class", () => {
    create(of({ articles: [article("a")], articlesCount: 25 }));

    pageItems()[1].querySelector("button")!.click();
    fixture.detectChanges();

    expect(vi.mocked(articles.query).mock.lastCall![0].filters).toEqual({
      limit: 10,
      offset: 10,
    });
    expect(pageItems().map((li) => li.classList.contains("active"))).toEqual([
      false,
      true,
      false,
    ]);
  });
});
