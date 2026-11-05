import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ListErrorsComponent } from "./list-errors.component";

describe("ListErrorsComponent (characterization)", () => {
  let fixture: ComponentFixture<ListErrorsComponent>;

  const list = (): HTMLUListElement | null =>
    fixture.nativeElement.querySelector("ul.error-messages");
  const items = (): string[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll("ul.error-messages li")
    ).map((li) => (li as HTMLElement).textContent!.trim());

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ListErrorsComponent] });
    fixture = TestBed.createComponent(ListErrorsComponent);
  });

  it("renders one <li> per error, in key order, as '<key> <message>'", () => {
    fixture.componentRef.setInput("errors", {
      errors: { email: "is invalid", password: "can't be blank" },
    });
    fixture.detectChanges();

    expect(list()).not.toBeNull();
    expect(items()).toEqual(["email is invalid", "password can't be blank"]);
  });

  it("replaces the rendered items when the errors input changes", () => {
    fixture.componentRef.setInput("errors", { errors: { a: "1", b: "2" } });
    fixture.detectChanges();
    fixture.componentRef.setInput("errors", { errors: { c: "3" } });
    fixture.detectChanges();

    expect(items()).toEqual(["c 3"]);
  });

  // KNOWN BUG (locked): errorList is always an array and [] is truthy, so the
  // *ngIf never hides the list; an empty <ul> is rendered with no errors.
  it("KNOWN BUG (locked): renders an empty <ul> when errors is null", () => {
    fixture.componentRef.setInput("errors", null);
    fixture.detectChanges();

    expect(list()).not.toBeNull();
    expect(items()).toEqual([]);
  });

  it("KNOWN BUG (locked): renders an empty <ul> before any input is set", () => {
    fixture.detectChanges();

    expect(list()).not.toBeNull();
    expect(items()).toEqual([]);
  });
});
