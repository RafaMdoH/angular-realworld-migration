import type { MockedObject } from "vitest";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, provideRouter } from "@angular/router";
import { BehaviorSubject, Observable, Subject, of } from "rxjs";
import { Profile } from "../../core/models/profile.model";
import { User } from "../../core/models/user.model";
import { ProfileService } from "../../core/services/profile.service";
import { UserService } from "../../core/services/user.service";
import { ProfileComponent } from "./profile.component";

describe("ProfileComponent (characterization)", () => {
  const bob: Profile = {
    username: "bob",
    bio: "Bob's bio",
    image: "bob.png",
    following: false,
  };
  const userNamed = (username: string): User => ({
    email: "x@y.z",
    token: "t",
    username,
    bio: "",
    image: "",
  });

  let profileService: MockedObject<ProfileService>;
  let fixture: ComponentFixture<ProfileComponent>;

  const el = (): HTMLElement => fixture.nativeElement;
  const followButton = (): Element | null =>
    el().querySelector(".user-info app-follow-button");
  const settingsLink = (): HTMLAnchorElement | null =>
    el().querySelector(".user-info a.action-btn");

  function create(profile: Observable<Profile>, user: User | null): void {
    profileService = {
      get: vi.fn().mockName("ProfileService.get"),
    } as unknown as MockedObject<ProfileService>;
    profileService.get.mockReturnValue(profile);
    TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: ProfileService, useValue: profileService },
        {
          provide: UserService,
          useValue: { currentUser: new BehaviorSubject<User | null>(user) },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { username: "bob" } } },
        },
      ],
    });
    fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
  }

  it("renders nothing while the profile is loading", () => {
    create(new Subject<Profile>(), null);

    expect(profileService.get).toHaveBeenCalledTimes(1);

    expect(profileService.get).toHaveBeenCalledWith("bob");
    expect(el().querySelector(".profile-page")).toBeNull();
  });

  it("renders the profile info once loaded", () => {
    create(of(bob), null);

    expect(el().querySelector(".profile-page")).not.toBeNull();
    expect(el().querySelector(".user-info h4")!.textContent!.trim()).toBe(
      "bob"
    );
    expect(el().querySelector(".user-info p")!.textContent!.trim()).toBe(
      "Bob's bio"
    );
    expect(el().querySelector("img.user-img")!.getAttribute("src")).toBe(
      "bob.png"
    );
    expect(
      Array.from(el().querySelectorAll(".articles-toggle a")).map((a) =>
        a.getAttribute("href")
      )
    ).toEqual(["/profile/bob", "/profile/bob/favorites"]);
  });

  it("shows the follow button and no settings link for another user's profile", () => {
    create(of(bob), userNamed("alice"));

    expect(followButton()).not.toBeNull();
    expect(settingsLink()).toBeNull();
  });

  it("shows the follow button and no settings link for anonymous users", () => {
    create(of(bob), null);

    expect(followButton()).not.toBeNull();
    expect(settingsLink()).toBeNull();
  });

  it("shows the settings link and no follow button on the user's own profile", () => {
    create(of(bob), userNamed("bob"));

    expect(followButton()).toBeNull();
    expect(settingsLink()).not.toBeNull();
    expect(settingsLink()!.getAttribute("href")).toBe("/settings");
    expect(settingsLink()!.textContent!.trim()).toBe("Edit Profile Settings");
  });
});
