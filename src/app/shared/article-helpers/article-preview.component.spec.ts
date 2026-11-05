import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { Article } from "../../core/models/article.model";
import { ArticlesService } from "../../core/services/articles.service";
import { UserService } from "../../core/services/user.service";
import { ArticlePreviewComponent } from "./article-preview.component";

describe("ArticlePreviewComponent (characterization)", () => {
  const article = (tagList: string[]): Article => ({
    slug: "my-slug",
    title: "Title",
    description: "Description",
    body: "Body",
    tagList,
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
    favorited: false,
    favoritesCount: 3,
    author: { username: "alice", bio: "", image: "", following: false },
  });

  let fixture: ComponentFixture<ArticlePreviewComponent>;

  const tags = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll(".tag-list li")).map(
      (li) => (li as HTMLElement).textContent!.trim()
    );

  function create(value: Article): void {
    TestBed.configureTestingModule({
      imports: [ArticlePreviewComponent],
      providers: [
        provideRouter([]),
        { provide: ArticlesService, useValue: {} },
        { provide: UserService, useValue: {} },
      ],
    });
    fixture = TestBed.createComponent(ArticlePreviewComponent);
    fixture.componentRef.setInput("article", value);
    fixture.detectChanges();
  }

  it("renders one tag pill per tag, in order", () => {
    create(article(["angular", "rxjs", "testing"]));

    expect(tags()).toEqual(["angular", "rxjs", "testing"]);
    const pill = fixture.nativeElement.querySelector(".tag-list li");
    expect(pill.className).toBe("tag-default tag-pill tag-outline");
  });

  it("renders an empty tag list when the article has no tags", () => {
    create(article([]));

    expect(fixture.nativeElement.querySelector(".tag-list")).not.toBeNull();
    expect(tags()).toEqual([]);
  });

  it("re-renders the pills when tagList is replaced", () => {
    const value = article(["a", "b"]);
    create(value);

    value.tagList = ["c"];
    // Zoneless: a direct field write does not notify Angular; mark the view first.
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect(tags()).toEqual(["c"]);
  });

  it("renders title, description and the article link", () => {
    create(article(["x"]));

    const link = fixture.nativeElement.querySelector("a.preview-link");
    expect(link.getAttribute("href")).toBe("/article/my-slug");
    expect(link.querySelector("h1").textContent.trim()).toBe("Title");
    expect(link.querySelector("p").textContent.trim()).toBe("Description");
  });
});
