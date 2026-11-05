import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { BehaviorSubject, Subject } from "rxjs";
import { Article } from "../../core/models/article.model";
import { ArticlesService } from "../../core/services/articles.service";
import { TagsService } from "../../core/services/tags.service";
import { UserService } from "../../core/services/user.service";
import { HomeComponent } from "./home.component";

// Zoneless regression specs: no fixture.detectChanges(). The fixture
// auto-detects by default under zoneless; every assertion reads the DOM after
// an async emission that happens after the first render.
//
// Services are stubbed with Subjects instead of HttpTestingController: a
// pending HttpClient request is a PendingTask, so whenStable() would not
// resolve before the flush and the first render could not be awaited.
describe("HomeComponent (zoneless)", () => {
  let tags: Subject<string[]>;
  let fixture: ComponentFixture<HomeComponent>;

  const tagLinks = (): string[] =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(".tag-list a")
    ).map((a) => a.textContent!.trim());

  it("control: renders the tags through *rxLet after they emit asynchronously", async () => {
    tags = new Subject<string[]>();
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: TagsService, useValue: { getAll: () => tags } },
        {
          provide: ArticlesService,
          useValue: {
            query: () =>
              new Subject<{ articles: Article[]; articlesCount: number }>(),
          },
        },
        {
          provide: UserService,
          useValue: { isAuthenticated: new BehaviorSubject<boolean>(false) },
        },
      ],
    });
    vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    fixture = TestBed.createComponent(HomeComponent);
    await fixture.whenStable();
    expect(tagLinks()).toEqual([]);

    tags.next(["angular", "rxjs"]);
    await fixture.whenStable();

    // *rxLet renders through rx-angular's own scheduler, which whenStable()
    // does not track, so poll the DOM instead of calling detectChanges().
    await vi.waitFor(() => expect(tagLinks()).toEqual(["angular", "rxjs"]));
  });
});
