import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { User } from "../models/user.model";
import { UserService } from "../services/user.service";
import { HeaderComponent } from "./header.component";

describe("HeaderComponent (characterization)", () => {
  const alice: User = {
    email: "a@b.c",
    token: "t",
    username: "alice",
    bio: "",
    image: "alice.png",
  };

  let currentUser$: BehaviorSubject<User | null>;
  let isAuthenticated$: BehaviorSubject<boolean>;
  let fixture: ComponentFixture<HeaderComponent>;

  const navLists = (): HTMLUListElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll("ul.navbar-nav"));
  const linkTexts = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll("ul.navbar-nav a")).map(
      (a) => (a as HTMLElement).textContent!.trim()
    );
  const profileLink = (): HTMLAnchorElement | null =>
    fixture.nativeElement.querySelector('ul.navbar-nav a[href^="/profile/"]');

  function create(authenticated: boolean, user: User | null): void {
    isAuthenticated$ = new BehaviorSubject<boolean>(authenticated);
    currentUser$ = new BehaviorSubject<User | null>(user);
    TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        {
          provide: UserService,
          useValue: {
            isAuthenticated: isAuthenticated$,
            currentUser: currentUser$,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
  }

  it("shows the guest links and no profile item when logged out", () => {
    create(false, null);

    expect(navLists().length).toBe(1);
    expect(linkTexts()).toEqual(["Home", "Sign in", "Sign up"]);
    expect(profileLink()).toBeNull();
  });

  it("shows the profile item with avatar and username when logged in", () => {
    create(true, alice);

    expect(navLists().length).toBe(1);
    expect(linkTexts()).toEqual(["Home", "New Article", "Settings", "alice"]);
    const link = profileLink()!;
    expect(link.getAttribute("href")).toBe("/profile/alice");
    const img = link.querySelector("img.user-pic") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("alice.png");
  });

  it("hides the avatar when the current user has no image", () => {
    create(true, { ...alice, image: "" });

    expect(profileLink()).not.toBeNull();
    expect(profileLink()!.textContent!.trim()).toBe("alice");
    expect(profileLink()!.querySelector("img")).toBeNull();
  });

  it("omits the profile item while authenticated but currentUser is null", () => {
    create(true, null);

    expect(linkTexts()).toEqual(["Home", "New Article", "Settings"]);
    expect(profileLink()).toBeNull();
  });

  it("updates the profile item when currentUser emits a new user", () => {
    create(true, alice);

    currentUser$.next({ ...alice, username: "bob", image: "" });
    fixture.detectChanges();

    expect(profileLink()!.getAttribute("href")).toBe("/profile/bob");
    expect(profileLink()!.textContent!.trim()).toBe("bob");
    expect(profileLink()!.querySelector("img")).toBeNull();
  });
});
