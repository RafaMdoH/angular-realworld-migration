import type { MockedObject } from "vitest";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, provideRouter } from "@angular/router";
import { BehaviorSubject, Subject } from "rxjs";
import { Profile } from "../../core/models/profile.model";
import { User } from "../../core/models/user.model";
import { ProfileService } from "../../core/services/profile.service";
import { UserService } from "../../core/services/user.service";
import { ProfileComponent } from "./profile.component";

// Zoneless regression specs: no fixture.detectChanges(). The fixture
// auto-detects by default under zoneless; every assertion reads the DOM after
// an async emission that happens after the first render.
describe("ProfileComponent (zoneless)", () => {
  const bob: Profile = {
    username: "bob",
    bio: "Bob's bio",
    image: "bob.png",
    following: false,
  };

  let profileService: MockedObject<ProfileService>;
  let fixture: ComponentFixture<ProfileComponent>;

  const el = (): HTMLElement => fixture.nativeElement;

  it("renders the profile after it emits asynchronously", async () => {
    const response = new Subject<Profile>();
    profileService = {
      get: vi.fn().mockName("ProfileService.get"),
    } as unknown as MockedObject<ProfileService>;
    profileService.get.mockReturnValue(response);
    TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ProfileService, useValue: profileService },
        {
          provide: UserService,
          useValue: { currentUser: new BehaviorSubject<User | null>(null) },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { username: "bob" } } },
        },
      ],
    });
    fixture = TestBed.createComponent(ProfileComponent);
    await fixture.whenStable();
    expect(el().querySelector(".profile-page")).toBeNull();

    response.next(bob);
    await fixture.whenStable();

    expect(el().querySelector(".user-info h4")?.textContent?.trim()).toBe(
      "bob"
    );
  });
});
