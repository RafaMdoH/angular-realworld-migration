import type { MockedObject } from "vitest";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, provideRouter } from "@angular/router";
import { BehaviorSubject, Observable, Subject, of } from "rxjs";
import { Article } from "../../core/models/article.model";
import { Comment } from "../../core/models/comment.model";
import { User } from "../../core/models/user.model";
import { ArticlesService } from "../../core/services/articles.service";
import { CommentsService } from "../../core/services/comments.service";
import { ProfileService } from "../../core/services/profile.service";
import { UserService } from "../../core/services/user.service";
import { ArticleComponent } from "./article.component";

// Zoneless regression specs: no fixture.detectChanges(). The fixture
// auto-detects by default under zoneless; every assertion reads the DOM after
// an async emission that happens after the first render.
describe("ArticleComponent (zoneless)", () => {
  const article = (): Article => ({
    slug: "my-slug",
    title: "My title",
    description: "D",
    body: "Body text",
    tagList: ["angular"],
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
    favorited: false,
    favoritesCount: 3,
    author: { username: "alice", bio: "", image: "", following: false },
  });
  const comment = (id: string, body = `comment ${id}`): Comment => ({
    id,
    body,
    createdAt: "2024-01-02T00:00:00.000Z",
    author: { username: "bob", bio: "", image: "", following: false },
  });
  const bob: User = {
    email: "x@y.z",
    token: "t",
    username: "bob",
    bio: "",
    image: "",
  };

  let articles: MockedObject<ArticlesService>;
  let comments: MockedObject<CommentsService>;
  let fixture: ComponentFixture<ArticleComponent>;

  const el = (): HTMLElement => fixture.nativeElement;
  const commentBodies = (): string[] =>
    Array.from(el().querySelectorAll("app-article-comment .card-text")).map(
      (p) => p.textContent!.trim()
    );
  const markdownBody = (): HTMLElement =>
    el().querySelector(".article-content .col-md-12 > div")!;
  const commentForm = (): HTMLFormElement =>
    el().querySelector("form.comment-form")!;
  const commentFieldset = (): HTMLFieldSetElement =>
    commentForm().querySelector("fieldset")!;
  const errorItems = (): string[] =>
    Array.from(el().querySelectorAll(".error-messages li")).map((li) =>
      li.textContent!.trim()
    );

  async function create(
    articleResponse: Observable<Article>,
    commentList: Comment[] = []
  ): Promise<void> {
    articles = {
      get: vi.fn().mockName("ArticlesService.get"),
      delete: vi.fn().mockName("ArticlesService.delete"),
    } as unknown as MockedObject<ArticlesService>;
    articles.get.mockReturnValue(articleResponse);
    comments = {
      getAll: vi.fn().mockName("CommentsService.getAll"),
      add: vi.fn().mockName("CommentsService.add"),
      delete: vi.fn().mockName("CommentsService.delete"),
    } as unknown as MockedObject<CommentsService>;
    comments.getAll.mockReturnValue(of(commentList));
    TestBed.configureTestingModule({
      imports: [ArticleComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ArticlesService, useValue: articles },
        { provide: CommentsService, useValue: comments },
        { provide: ProfileService, useValue: {} },
        {
          provide: UserService,
          useValue: {
            currentUser: new BehaviorSubject<User | null>(bob),
            isAuthenticated: new BehaviorSubject<boolean>(true),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { slug: "my-slug" } } },
        },
      ],
    });
    vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    fixture = TestBed.createComponent(ArticleComponent);
    await fixture.whenStable();
  }

  // The markdown body resolves through `| markdown | async` (a dynamic
  // import), which notifies the scheduler on its own. Let it settle first so
  // it cannot refresh the view during the emission under test.
  async function settleMarkdown(): Promise<void> {
    await vi.waitFor(() => expect(markdownBody().innerHTML).toContain("Body"));
    await fixture.whenStable();
  }

  it("renders the article after the article and comments emit asynchronously", async () => {
    const response = new Subject<Article>();
    await create(response);
    expect(el().querySelector(".article-page")).toBeNull();

    response.next(article());
    await fixture.whenStable();

    expect(el().querySelector(".banner h1")?.textContent?.trim()).toBe(
      "My title"
    );
  });

  it("renders a posted comment at the top after the add request succeeds asynchronously", async () => {
    await create(of(article()), [comment("1")]);
    await settleMarkdown();
    const response = new Subject<Comment>();
    comments.add.mockReturnValue(response);
    const textarea = commentForm().querySelector("textarea")!;
    textarea.value = "new one";
    textarea.dispatchEvent(new Event("input"));
    commentForm().dispatchEvent(new Event("submit"));
    await fixture.whenStable();
    expect(commentFieldset().disabled).toBe(true);

    response.next(comment("2", "new one"));
    await fixture.whenStable();

    expect(commentBodies()).toEqual(["new one", "comment 1"]);
    expect(commentFieldset().disabled).toBe(false);
  });

  it("renders a posted comment after the add request succeeds asynchronously even when the form state does not change", async () => {
    await create(of(article()), [comment("1")]);
    await settleMarkdown();
    const response = new Subject<Comment>();
    comments.add.mockReturnValue(response);
    // Set the value without user input: the control stays pristine, so
    // reset() after success flips no form-state signal that could refresh the view.
    fixture.componentInstance.commentControl.setValue("new one");
    commentForm().dispatchEvent(new Event("submit"));
    await fixture.whenStable();
    expect(commentFieldset().disabled).toBe(true);

    response.next(comment("2", "new one"));
    await fixture.whenStable();

    expect(commentBodies()).toEqual(["new one", "comment 1"]);
    expect(commentFieldset().disabled).toBe(false);
  });

  it("lists the errors and re-enables the comment form after the add request fails asynchronously", async () => {
    await create(of(article()), [comment("1")]);
    await settleMarkdown();
    const response = new Subject<Comment>();
    comments.add.mockReturnValue(response);
    commentForm().dispatchEvent(new Event("submit"));
    await fixture.whenStable();
    expect(commentFieldset().disabled).toBe(true);

    response.error({ errors: { body: "can't be blank" } });
    await fixture.whenStable();

    expect(errorItems()).toEqual(["body can't be blank"]);
    expect(commentFieldset().disabled).toBe(false);
  });

  it("removes a deleted comment after the delete request succeeds asynchronously", async () => {
    await create(of(article()), [comment("1"), comment("2")]);
    await settleMarkdown();
    const response = new Subject<void>();
    comments.delete.mockReturnValue(response);
    (
      el().querySelector("app-article-comment .mod-options i") as HTMLElement
    ).click();
    await fixture.whenStable();
    expect(comments.delete).toHaveBeenCalledWith("1", "my-slug");

    response.next();
    await fixture.whenStable();

    expect(commentBodies()).toEqual(["comment 2"]);
  });

  it("control: renders the markdown body when the async pipe's promise resolves", async () => {
    await create(of(article()));
    expect(markdownBody().innerHTML).toBe("");

    // AsyncPipe calls markForCheck() on resolution; whenStable() does not
    // track the promise, so poll the DOM instead of calling detectChanges().
    await vi.waitFor(() =>
      expect(markdownBody().innerHTML).toContain("<p>Body text</p>")
    );
  });
});
