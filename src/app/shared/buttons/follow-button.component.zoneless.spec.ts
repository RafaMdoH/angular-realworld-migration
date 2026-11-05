import type { MockedObject } from "vitest";
import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { BehaviorSubject, Subject } from "rxjs";
import { Profile } from "../../core/models/profile.model";
import { ProfileService } from "../../core/services/profile.service";
import { UserService } from "../../core/services/user.service";
import { FollowButtonComponent } from "./follow-button.component";

// Zoneless regression specs: no fixture.detectChanges(). The fixture
// auto-detects by default under zoneless; every assertion reads the DOM after
// an async emission that happens after the first render.
describe("FollowButtonComponent (zoneless)", () => {
  let profiles: MockedObject<ProfileService>;
  let fixture: ComponentFixture<FollowButtonComponent>;

  const button = (): HTMLButtonElement =>
    (fixture.nativeElement as HTMLElement).querySelector("button")!;

  it("re-enables the button after the follow request fails asynchronously", async () => {
    const response = new Subject<Profile>();
    profiles = {
      follow: vi.fn().mockName("ProfileService.follow"),
      unfollow: vi.fn().mockName("ProfileService.unfollow"),
    } as unknown as MockedObject<ProfileService>;
    profiles.follow.mockReturnValue(response);
    TestBed.configureTestingModule({
      imports: [FollowButtonComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ProfileService, useValue: profiles },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: UserService,
          useValue: { isAuthenticated: new BehaviorSubject<boolean>(true) },
        },
      ],
    });
    fixture = TestBed.createComponent(FollowButtonComponent);
    fixture.componentRef.setInput("profile", {
      username: "bob",
      bio: "",
      image: "",
      following: false,
    });
    await fixture.whenStable();
    button().click();
    await fixture.whenStable();
    expect(button().classList).toContain("disabled");

    response.error({ errors: {} });
    await fixture.whenStable();

    expect(button().classList).not.toContain("disabled");
  });
});
