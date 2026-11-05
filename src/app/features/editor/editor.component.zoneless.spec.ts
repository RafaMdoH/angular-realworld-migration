import type { MockedObject } from "vitest";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, of } from "rxjs";
import { Article } from "../../core/models/article.model";
import { User } from "../../core/models/user.model";
import { ArticlesService } from "../../core/services/articles.service";
import { UserService } from "../../core/services/user.service";
import { EditorComponent } from "./editor.component";

// Zoneless regression specs: no fixture.detectChanges(). The fixture
// auto-detects by default under zoneless; every assertion reads the DOM after
// an async emission that happens after the first render.
describe("EditorComponent (zoneless)", () => {
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
  let fixture: ComponentFixture<EditorComponent>;

  const el = (): HTMLElement => fixture.nativeElement;
  const tagPills = (): string[] =>
    Array.from(el().querySelectorAll(".tag-list .tag-pill")).map((span) =>
      span.textContent!.trim()
    );
  const formFieldset = (): HTMLFieldSetElement =>
    el().querySelector("form > fieldset")!;
  const errorItems = (): string[] =>
    Array.from(el().querySelectorAll(".error-messages li")).map((li) =>
      li.textContent!.trim()
    );

  async function create(params: Record<string, string> = {}): Promise<void> {
    articles = {
      get: vi.fn().mockName("ArticlesService.get"),
      create: vi.fn().mockName("ArticlesService.create"),
    } as unknown as MockedObject<ArticlesService>;
    TestBed.configureTestingModule({
      imports: [EditorComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ArticlesService, useValue: articles },
        {
          provide: UserService,
          useValue: { getCurrentUser: () => of({ user }) },
        },
        {
          provide: Router,
          useValue: { navigate: vi.fn().mockResolvedValue(true) },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { params } } },
      ],
    });
    fixture = TestBed.createComponent(EditorComponent);
  }

  it("renders the loaded article's tags after the article emits asynchronously (edit mode)", async () => {
    await create({ slug: "my-slug" });
    const response = new Subject<Article>();
    articles.get.mockReturnValue(response);
    await fixture.whenStable();
    expect(tagPills()).toEqual([]);

    response.next(article);
    await fixture.whenStable();

    expect(tagPills()).toEqual(["x", "y"]);
  });

  it("lists the errors and re-enables the form after an async create error", async () => {
    await create();
    await fixture.whenStable();
    const response = new Subject<Article>();
    articles.create.mockReturnValue(response);
    (el().querySelector("button.btn-primary") as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(formFieldset().disabled).toBe(true);

    response.error({ errors: { title: "can't be blank" } });
    await fixture.whenStable();

    expect(errorItems()).toEqual(["title can't be blank"]);
    expect(formFieldset().disabled).toBe(false);
  });
});
