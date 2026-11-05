import type { MockedObject } from "vitest";
import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
} from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { BehaviorSubject, Subject } from "rxjs";
import { Article } from "../../core/models/article.model";
import { ArticlesService } from "../../core/services/articles.service";
import { UserService } from "../../core/services/user.service";
import { FavoriteButtonComponent } from "./favorite-button.component";

@Component({
  imports: [FavoriteButtonComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-favorite-button [article]="article" (toggle)="onToggle($event)">
      <span class="count">{{ article.favoritesCount }}</span>
    </app-favorite-button>
  `,
})
class HostComponent {
  article: Article = {
    slug: "my-slug",
    title: "T",
    description: "D",
    body: "B",
    tagList: [],
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
    favorited: false,
    favoritesCount: 3,
    author: { username: "alice", bio: "", image: "", following: false },
  };

  onToggle(favorited: boolean): void {
    this.article.favorited = favorited;
    this.article.favoritesCount += favorited ? 1 : -1;
  }
}

// Zoneless regression specs: no fixture.detectChanges(). The fixture
// auto-detects by default under zoneless; every assertion reads the DOM after
// an async emission that happens after the first render.
describe("FavoriteButtonComponent (zoneless)", () => {
  let articles: MockedObject<ArticlesService>;
  let response: Subject<Article>;
  let fixture: ComponentFixture<HostComponent>;

  const button = (): HTMLButtonElement =>
    (fixture.nativeElement as HTMLElement).querySelector("button")!;

  beforeEach(async () => {
    response = new Subject<Article>();
    articles = {
      favorite: vi.fn().mockName("ArticlesService.favorite"),
      unfavorite: vi.fn().mockName("ArticlesService.unfavorite"),
    } as unknown as MockedObject<ArticlesService>;
    articles.favorite.mockReturnValue(response);
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ArticlesService, useValue: articles },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: UserService,
          useValue: { isAuthenticated: new BehaviorSubject<boolean>(true) },
        },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    button().click();
    await fixture.whenStable();
    expect(button().classList).toContain("disabled");
  });

  it("re-enables the button after the favorite request fails asynchronously", async () => {
    response.error({ errors: {} });
    await fixture.whenStable();

    expect(button().classList).not.toContain("disabled");
  });

  it("control: re-enables the button and updates the parent after the favorite request succeeds asynchronously", async () => {
    response.next({} as Article);
    await fixture.whenStable();

    // The (toggle) output runs a template listener in the host, which marks
    // the host view dirty and schedules change detection.
    expect(button().classList).not.toContain("disabled");
    expect(button().classList).toContain("btn-primary");
    expect(button().querySelector(".count")!.textContent).toBe("4");
  });
});
