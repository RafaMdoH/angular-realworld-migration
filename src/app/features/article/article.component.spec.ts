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

describe("ArticleComponent (characterization)", () => {
  const article = (): Article => ({
    slug: "my-slug",
    title: "My title",
    description: "D",
    body: "Body",
    tagList: ["angular", "rxjs"],
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
  const userNamed = (username: string): User => ({
    email: "x@y.z",
    token: "t",
    username,
    bio: "",
    image: "",
  });

  let articles: jasmine.SpyObj<ArticlesService>;
  let comments: jasmine.SpyObj<CommentsService>;
  let fixture: ComponentFixture<ArticleComponent>;
  let component: ArticleComponent;

  const el = (): HTMLElement => fixture.nativeElement;
  const all = (selector: string): HTMLElement[] =>
    Array.from(el().querySelectorAll(selector));
  const commentEls = (): HTMLElement[] => all("app-article-comment");
  const commentBodies = (): string[] =>
    all("app-article-comment .card-text").map((p) => p.textContent!.trim());

  function create(
    articleResponse: Observable<Article>,
    user: User | null,
    commentList: Comment[] = []
  ): void {
    articles = jasmine.createSpyObj<ArticlesService>("ArticlesService", [
      "get",
      "delete",
    ]);
    articles.get.and.returnValue(articleResponse);
    comments = jasmine.createSpyObj<CommentsService>("CommentsService", [
      "getAll",
      "add",
      "delete",
    ]);
    comments.getAll.and.returnValue(of(commentList));
    const currentUser = new BehaviorSubject<User | null>(user);
    TestBed.configureTestingModule({
      imports: [ArticleComponent],
      providers: [
        provideRouter([]),
        { provide: ArticlesService, useValue: articles },
        { provide: CommentsService, useValue: comments },
        { provide: ProfileService, useValue: {} },
        {
          provide: UserService,
          useValue: {
            currentUser,
            isAuthenticated: new BehaviorSubject<boolean>(!!user),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { slug: "my-slug" } } },
        },
      ],
    });
    spyOn(TestBed.inject(Router), "navigate").and.resolveTo(true);
    fixture = TestBed.createComponent(ArticleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe("article page (*ngIf=article)", () => {
    it("renders nothing while the article is loading", () => {
      create(new Subject<Article>(), null);

      expect(articles.get).toHaveBeenCalledOnceWith("my-slug");
      expect(el().querySelector(".article-page")).toBeNull();
    });

    it("renders the title and one tag pill per tag, in order, once loaded", () => {
      create(of(article()), null);

      expect(el().querySelector(".article-page")).not.toBeNull();
      expect(el().querySelector(".banner h1")!.textContent!.trim()).toBe(
        "My title"
      );
      expect(all(".tag-list li").map((li) => li.textContent!.trim())).toEqual([
        "angular",
        "rxjs",
      ]);
    });

    it("renders an empty tag list when the article has no tags", () => {
      create(of({ ...article(), tagList: [] }), null);

      expect(el().querySelector(".tag-list")).not.toBeNull();
      expect(all(".tag-list li").length).toBe(0);
    });
  });

  describe("meta actions (*ngIf=canModify / !canModify)", () => {
    it("shows edit and delete in both meta blocks for the author", () => {
      create(of(article()), userNamed("alice"));

      expect(component.canModify).toBeTrue();
      expect(all('a[href="/editor/my-slug"]').length).toBe(2);
      expect(all("button.btn-outline-danger").length).toBe(2);
      expect(all("app-follow-button").length).toBe(0);
      expect(all("app-favorite-button").length).toBe(0);
    });

    it("shows follow and favorite in both meta blocks for another user", () => {
      create(of(article()), userNamed("bob"));

      expect(component.canModify).toBeFalse();
      expect(all('a[href="/editor/my-slug"]').length).toBe(0);
      expect(all("button.btn-outline-danger").length).toBe(0);
      expect(all("app-follow-button").length).toBe(2);
      const favorites = all("app-favorite-button");
      expect(favorites.length).toBe(2);
      expect(favorites[0].textContent!.replace(/\s+/g, " ").trim()).toContain(
        "Favorite Article (3)"
      );
    });

    it("shows follow and favorite for anonymous users", () => {
      create(of(article()), null);

      expect(all("app-follow-button").length).toBe(2);
      expect(all('a[href="/editor/my-slug"]').length).toBe(0);
    });
  });

  describe("comments (*ngFor trackBy: trackById)", () => {
    it("renders one comment per item, in order", () => {
      create(of(article()), null, [comment("1"), comment("2"), comment("3")]);

      expect(commentBodies()).toEqual(["comment 1", "comment 2", "comment 3"]);
    });

    it("renders no comments for an empty list", () => {
      create(of(article()), null, []);

      expect(commentEls().length).toBe(0);
    });

    it("reuses the DOM nodes when the list is replaced by new objects with the same ids", () => {
      create(of(article()), null, [comment("1"), comment("2")]);
      const before = commentEls();

      component.comments = [comment("1", "edited 1"), comment("2")];
      fixture.detectChanges();

      const after = commentEls();
      expect(after.length).toBe(2);
      expect(after[0]).toBe(before[0]);
      expect(after[1]).toBe(before[1]);
      expect(commentBodies()).toEqual(["edited 1", "comment 2"]);
    });

    it("creates a new node only for a new id and moves reordered ones", () => {
      create(of(article()), null, [comment("1"), comment("2")]);
      const [first, second] = commentEls();

      component.comments = [comment("3"), comment("2"), comment("1")];
      fixture.detectChanges();

      const after = commentEls();
      expect(after.length).toBe(3);
      expect(after[0]).not.toBe(first);
      expect(after[0]).not.toBe(second);
      expect(after[1]).toBe(second);
      expect(after[2]).toBe(first);
    });

    it("adds a posted comment at the top (in-place unshift)", () => {
      create(of(article()), userNamed("bob"), [comment("1")]);
      comments.add.and.returnValue(of(comment("2", "new one")));

      component.addComment();
      fixture.detectChanges();

      expect(commentBodies()).toEqual(["new one", "comment 1"]);
    });

    it("removes a deleted comment and keeps the remaining node", () => {
      create(of(article()), userNamed("bob"), [comment("1"), comment("2")]);
      comments.delete.and.returnValue(of(undefined));
      const second = commentEls()[1];

      component.deleteComment(component.comments[0]);
      fixture.detectChanges();

      expect(comments.delete).toHaveBeenCalledOnceWith("1", "my-slug");
      expect(commentBodies()).toEqual(["comment 2"]);
      expect(commentEls()[0]).toBe(second);
    });
  });
});
