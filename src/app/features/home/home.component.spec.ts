import { ComponentFixture, TestBed } from "@angular/core/testing";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { Router, provideRouter } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { HomeComponent } from "./home.component";
import { UserService } from "../../core/services/user.service";
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from "@angular/common/http";

// rx-angular's *rxLet renders through its own scheduler, outside the
// synchronous detectChanges() cycle, so the DOM is checked after a macrotask.
const nextRender = async (fixture: ComponentFixture<HomeComponent>) => {
  fixture.detectChanges();
  await new Promise((resolve) => setTimeout(resolve, 50));
  fixture.detectChanges();
};

describe("HomeComponent (characterization)", () => {
  let fixture: ComponentFixture<HomeComponent>;
  let controller: HttpTestingController;
  let router: Router;
  let isAuthenticated$: BehaviorSubject<boolean>;

  const setup = (authenticated: boolean) => {
    isAuthenticated$ = new BehaviorSubject<boolean>(authenticated);
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: UserService,
          useValue: { isAuthenticated: isAuthenticated$.asObservable() },
        },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, "navigate").and.resolveTo(true);
    fixture = TestBed.createComponent(HomeComponent);
  };

  const tagLinks = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll(".tag-list a")
    ) as HTMLAnchorElement[];

  it("renders the tags returned by GET /tags through *rxLet", async () => {
    setup(false);
    fixture.detectChanges();

    controller.expectOne("/tags").flush({ tags: ["angular", "rxjs"] });
    await nextRender(fixture);

    expect(tagLinks().map((a) => a.textContent?.trim())).toEqual([
      "angular",
      "rxjs",
    ]);
    expect(fixture.componentInstance.tagsLoaded).toBeTrue();
  });

  it("shows the empty message when there are no tags", async () => {
    setup(false);
    fixture.detectChanges();

    controller.expectOne("/tags").flush({ tags: [] });
    await nextRender(fixture);

    expect(tagLinks().length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain(
      "No tags are here... yet."
    );
  });

  it("filters the list by tag when a tag is clicked", async () => {
    setup(false);
    fixture.detectChanges();
    controller.expectOne("/tags").flush({ tags: ["angular"] });
    await nextRender(fixture);

    tagLinks()[0].click();

    expect(fixture.componentInstance.listConfig).toEqual({
      type: "all",
      filters: { tag: "angular" },
    });
  });

  it("uses the global list for anonymous users", () => {
    setup(false);
    fixture.detectChanges();

    expect(fixture.componentInstance.listConfig.type).toBe("all");
    expect(router.navigate).not.toHaveBeenCalled();
  });

  // KNOWN BUG (locked): tap() calls setListTo("feed") before subscribe()
  // assigns this.isAuthenticated, so an authenticated user is sent to /login.
  it("KNOWN BUG (locked): redirects an authenticated user to /login on init", () => {
    setup(true);
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(["/login"]);
    expect(fixture.componentInstance.listConfig.type).toBe("all");
    expect(fixture.componentInstance.isAuthenticated).toBeTrue();
  });
});
