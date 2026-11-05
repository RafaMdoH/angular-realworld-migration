import type { MockedObject } from "vitest";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, of, throwError } from "rxjs";
import { Article } from "../../core/models/article.model";
import { User } from "../../core/models/user.model";
import { ArticlesService } from "../../core/services/articles.service";
import { UserService } from "../../core/services/user.service";
import { EditorComponent } from "./editor.component";

describe("EditorComponent (characterization)", () => {
  const user: User = {
    email: "a@b.c",
    token: "t",
    username: "alice",
    bio: "",
    image: "",
  };
  const article = {
    slug: "my-slug",
    title: "T",
    description: "D",
    body: "B",
    tagList: ["x", "y"],
    author: { username: "alice" },
  } as Article;

  let articles: MockedObject<ArticlesService>;
  let userService: MockedObject<UserService>;
  let router: MockedObject<Router>;
  let fixture: ComponentFixture<EditorComponent>;
  let component: EditorComponent;

  function create(params: Record<string, string> = {}): void {
    TestBed.configureTestingModule({
      imports: [EditorComponent],
      providers: [
        { provide: ArticlesService, useValue: articles },
        { provide: UserService, useValue: userService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { params } } },
      ],
    });
    fixture = TestBed.createComponent(EditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    articles = {
      get: vi.fn().mockName("ArticlesService.get"),
      create: vi.fn().mockName("ArticlesService.create"),
      update: vi.fn().mockName("ArticlesService.update"),
    } as unknown as MockedObject<ArticlesService>;
    userService = {
      getCurrentUser: vi.fn().mockName("UserService.getCurrentUser"),
    } as unknown as MockedObject<UserService>;
    router = {
      navigate: vi.fn().mockName("Router.navigate"),
    } as unknown as MockedObject<Router>;
    router.navigate.mockResolvedValue(true);
  });

  describe("new article (no slug)", () => {
    beforeEach(() => create());

    it("does not load an article or the current user", () => {
      expect(articles.get).not.toHaveBeenCalled();
      expect(userService.getCurrentUser).not.toHaveBeenCalled();
      expect(component.tagList).toEqual([]);
    });

    it("addTag adds a tag and resets the tag field", () => {
      component.tagField.setValue("angular");

      component.addTag();

      expect(component.tagList).toEqual(["angular"]);
      expect(component.tagField.value).toBe("");
    });

    it("addTag ignores empty and whitespace-only tags but still resets the field", () => {
      component.tagField.setValue("   ");

      component.addTag();

      expect(component.tagList).toEqual([]);
      expect(component.tagField.value).toBe("");
    });

    it("addTag ignores duplicate tags", () => {
      component.tagField.setValue("a");
      component.addTag();
      component.tagField.setValue("a");
      component.addTag();

      expect(component.tagList).toEqual(["a"]);
    });

    it("addTag does not trim the stored tag", () => {
      component.tagField.setValue(" a ");

      component.addTag();

      expect(component.tagList).toEqual([" a "]);
    });

    it("removeTag removes only the given tag", () => {
      component.tagList = ["a", "b", "c"];

      component.removeTag("b");

      expect(component.tagList).toEqual(["a", "c"]);
    });

    it("submitForm creates the article with form values and tags, then navigates to it", () => {
      articles.create.mockReturnValue(of({ ...article, slug: "new-slug" }));
      component.articleForm.patchValue({
        title: "T",
        description: "D",
        body: "B",
      });
      component.tagList = ["a"];

      component.submitForm();

      expect(articles.create).toHaveBeenCalledTimes(1);

      expect(articles.create).toHaveBeenCalledWith({
        title: "T",
        description: "D",
        body: "B",
        tagList: ["a"],
      });
      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith(["/article/", "new-slug"]);
    });

    it("submitForm adds the pending tag field value to the payload", () => {
      articles.create.mockReturnValue(of(article));
      component.tagField.setValue("pending");

      component.submitForm();

      expect(vi.mocked(articles.create).mock.lastCall![0].tagList).toEqual([
        "pending",
      ]);
    });

    it("submitForm stores errors and re-enables the form on failure", () => {
      const err = { errors: { title: "cannot be blank" } };
      articles.create.mockReturnValue(throwError(() => err));

      component.submitForm();

      expect(component.errors).toBe(err);
      expect(component.isSubmitting).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("submitForm marks the form as submitting while pending", () => {
      articles.create.mockReturnValue(new Subject<Article>());

      component.submitForm();

      expect(component.isSubmitting).toBe(true);
    });
  });

  describe("existing article (slug in route)", () => {
    it("loads the article and patches the form when the current user is the author", () => {
      articles.get.mockReturnValue(of(article));
      userService.getCurrentUser.mockReturnValue(of({ user }));

      create({ slug: "my-slug" });

      expect(articles.get).toHaveBeenCalledTimes(1);

      expect(articles.get).toHaveBeenCalledWith("my-slug");
      expect(component.tagList).toEqual(["x", "y"]);
      expect(component.articleForm.value.title).toBe("T");
      expect(component.articleForm.value.description).toBe("D");
      expect(component.articleForm.value.body).toBe("B");
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("redirects to / when the current user is not the author", () => {
      articles.get.mockReturnValue(of(article));
      userService.getCurrentUser.mockReturnValue(
        of({ user: { ...user, username: "bob" } })
      );

      create({ slug: "my-slug" });

      expect(router.navigate).toHaveBeenCalledTimes(1);

      expect(router.navigate).toHaveBeenCalledWith(["/"]);
      expect(component.tagList).toEqual([]);
      expect(component.articleForm.value.title).toBe("");
    });

    it("KNOWN BUG (locked): submitForm always calls create, never update, when editing", () => {
      articles.get.mockReturnValue(of(article));
      userService.getCurrentUser.mockReturnValue(of({ user }));
      articles.create.mockReturnValue(of(article));
      create({ slug: "my-slug" });

      component.submitForm();

      expect(articles.create).toHaveBeenCalledTimes(1);
      expect(articles.update).not.toHaveBeenCalled();
      expect(vi.mocked(articles.create).mock.lastCall![0]).toEqual({
        title: "T",
        description: "D",
        body: "B",
        tagList: ["x", "y"],
      });
    });
  });
});
