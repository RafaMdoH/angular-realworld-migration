import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
} from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";
import { UserService } from "../core/services/user.service";
import { ShowAuthedDirective } from "./show-authed.directive";

@Component({
  imports: [ShowAuthedDirective],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <p id="authed" *appShowAuthed="true">{{ authedLabel }}</p>
    <p id="guest" *appShowAuthed="false">{{ guestLabel }}</p>
  `,
})
class HostComponent {
  authedLabel = "authed";
  guestLabel = "guest";
}

// Zoneless regression specs: no fixture.detectChanges(). The fixture
// auto-detects by default under zoneless; every assertion reads the DOM after
// an async emission that happens after the first render.
describe("ShowAuthedDirective (zoneless)", () => {
  let isAuthenticated: BehaviorSubject<boolean>;
  let fixture: ComponentFixture<HostComponent>;

  const text = (id: string): string | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`#${id}`)
      ?.textContent ?? null;

  async function create(initial: boolean): Promise<void> {
    isAuthenticated = new BehaviorSubject<boolean>(initial);
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: UserService, useValue: { isAuthenticated } },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  }

  // Bindings inside the block ({{ authedLabel }}) only reach the DOM through
  // change detection, so this proves the inserted view is refreshed, not just
  // created.
  it("control: renders the authed block with its bindings when auth turns true asynchronously", async () => {
    await create(false);
    expect(text("authed")).toBeNull();
    expect(text("guest")).toBe("guest");

    isAuthenticated.next(true);
    await fixture.whenStable();

    expect(text("authed")).toBe("authed");
    expect(text("guest")).toBeNull();
  });

  it("control: removes the authed block when auth turns false asynchronously", async () => {
    await create(true);
    expect(text("authed")).toBe("authed");

    isAuthenticated.next(false);
    await fixture.whenStable();

    expect(text("authed")).toBeNull();
  });
});
