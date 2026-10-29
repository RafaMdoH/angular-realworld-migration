import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { BehaviorSubject } from "rxjs";
import { UserService } from "../core/services/user.service";
import { ShowAuthedDirective } from "./show-authed.directive";

@Component({
  standalone: true,
  imports: [ShowAuthedDirective],
  template: `
    <p id="authed" *appShowAuthed="true">authed</p>
    <p id="guest" *appShowAuthed="false">guest</p>
  `,
})
class HostComponent {}

describe("ShowAuthedDirective (characterization)", () => {
  let isAuthenticated: BehaviorSubject<boolean>;
  let fixture: ComponentFixture<HostComponent>;

  const has = (id: string): boolean =>
    !!fixture.debugElement.query(By.css(`#${id}`));

  function create(initial: boolean): void {
    isAuthenticated = new BehaviorSubject<boolean>(initial);
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: UserService, useValue: { isAuthenticated } }],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  }

  function setAuth(value: boolean): void {
    isAuthenticated.next(value);
    fixture.detectChanges();
  }

  it("renders only the authed block when the user starts authenticated", () => {
    create(true);

    expect(has("authed")).toBeTrue();
    expect(has("guest")).toBeFalse();
  });

  it("renders only the guest block when the user starts unauthenticated", () => {
    create(false);

    expect(has("authed")).toBeFalse();
    expect(has("guest")).toBeTrue();
  });

  it("removes the authed block when auth turns false", () => {
    create(true);

    setAuth(false);

    expect(has("authed")).toBeFalse();
    expect(has("guest")).toBeTrue();
  });

  it("shows the authed block when auth turns true after starting false", () => {
    create(false);

    setAuth(true);

    expect(has("authed")).toBeTrue();
    expect(has("guest")).toBeFalse();
  });

  it("KNOWN BUG (locked): does not re-render after auth toggles back", () => {
    create(true);

    setAuth(false);
    setAuth(true);

    // authRef is never reset after viewContainer.clear(), so the view that
    // should reappear is never created again.
    expect(has("authed")).toBeFalse();
  });

  it("KNOWN BUG (locked): guest block also does not re-render after false -> true -> false", () => {
    create(false);

    setAuth(true);
    setAuth(false);

    expect(has("guest")).toBeFalse();
  });
});
