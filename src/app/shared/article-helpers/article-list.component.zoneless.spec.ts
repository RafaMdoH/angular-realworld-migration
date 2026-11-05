import type { MockedObject } from "vitest";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { BehaviorSubject, Subject } from "rxjs";
import { Article } from "../../core/models/article.model";
import { ArticlesService } from "../../core/services/articles.service";
import { UserService } from "../../core/services/user.service";
import { ArticleListComponent } from "./article-list.component";

// Zoneless regression specs: no fixture.detectChanges(). The fixture
// auto-detects by default under zoneless; every assertion reads the DOM after
// an async emission that happens after the first render.
describe("ArticleListComponent (zoneless)", () => {
  const article: Article = {
    slug: "my-slug",
    title: "My title",
    description: "D",
    body: "B",
    tagList: [],
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
    favorited: false,
    favoritesCount: 0,
    author: { username: "alice", bio: "", image: "", following: false },
  };

  let articles: MockedObject<ArticlesService>;
  let fixture: ComponentFixture<ArticleListComponent>;

  const el = (): HTMLElement => fixture.nativeElement;

  it("renders the results and drops the loading message after the query emits asynchronously", async () => {
    const response = new Subject<{
      articles: Article[];
      articlesCount: number;
    }>();
    articles = {
      query: vi.fn().mockName("ArticlesService.query"),
    } as unknown as MockedObject<ArticlesService>;
    articles.query.mockReturnValue(response);
    TestBed.configureTestingModule({
      imports: [ArticleListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ArticlesService, useValue: articles },
        {
          provide: UserService,
          useValue: { isAuthenticated: new BehaviorSubject<boolean>(false) },
        },
      ],
    });
    fixture = TestBed.createComponent(ArticleListComponent);
    fixture.componentRef.setInput("limit", 10);
    fixture.componentRef.setInput("config", { type: "all", filters: {} });
    await fixture.whenStable();
    expect(el().textContent).toContain("Loading articles...");

    response.next({ articles: [article], articlesCount: 1 });
    await fixture.whenStable();

    expect(el().querySelectorAll("app-article-preview").length).toBe(1);
    expect(el().textContent).not.toContain("Loading articles...");
  });
});
