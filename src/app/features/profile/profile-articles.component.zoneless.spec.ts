import type { MockedObject } from "vitest";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { Subject } from "rxjs";
import { Article } from "../../core/models/article.model";
import { Profile } from "../../core/models/profile.model";
import { ArticlesService } from "../../core/services/articles.service";
import { ProfileService } from "../../core/services/profile.service";
import { ProfileArticlesComponent } from "./profile-articles.component";

// Zoneless regression specs: no fixture.detectChanges(). The fixture
// auto-detects by default under zoneless; every assertion reads the DOM after
// an async emission that happens after the first render.
describe("ProfileArticlesComponent (zoneless)", () => {
  const bob: Profile = {
    username: "bob",
    bio: "",
    image: "",
    following: false,
  };

  let profileService: MockedObject<ProfileService>;
  let articles: MockedObject<ArticlesService>;
  let fixture: ComponentFixture<ProfileArticlesComponent>;

  const el = (): HTMLElement => fixture.nativeElement;

  it("passes the author config to the article list after the profile emits asynchronously", async () => {
    const response = new Subject<Profile>();
    profileService = {
      get: vi.fn().mockName("ProfileService.get"),
    } as unknown as MockedObject<ProfileService>;
    profileService.get.mockReturnValue(response);
    articles = {
      query: vi.fn().mockName("ArticlesService.query"),
    } as unknown as MockedObject<ArticlesService>;
    articles.query.mockReturnValue(
      new Subject<{ articles: Article[]; articlesCount: number }>()
    );
    TestBed.configureTestingModule({
      imports: [ProfileArticlesComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ProfileService, useValue: profileService },
        { provide: ArticlesService, useValue: articles },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { username: "bob" } } },
        },
      ],
    });
    fixture = TestBed.createComponent(ProfileArticlesComponent);
    await fixture.whenStable();
    expect(el().textContent).not.toContain("Loading articles...");

    response.next(bob);
    await fixture.whenStable();

    // The list renders its loading state only once it receives a config.
    expect(el().textContent).toContain("Loading articles...");
    expect(articles.query).toHaveBeenCalledWith({
      type: "all",
      filters: { author: "bob", limit: 10, offset: 0 },
    });
  });
});
