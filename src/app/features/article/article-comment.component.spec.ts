import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { Comment } from "../../core/models/comment.model";
import { User } from "../../core/models/user.model";
import { UserService } from "../../core/services/user.service";
import { ArticleCommentComponent } from "./article-comment.component";

describe("ArticleCommentComponent (characterization)", () => {
  const comment: Comment = {
    id: "1",
    body: "Nice article",
    createdAt: "2024-01-02T12:00:00.000Z",
    author: { username: "bob", bio: "", image: "bob.png", following: false },
  };
  const userNamed = (username: string): User => ({
    email: "x@y.z",
    token: "t",
    username,
    bio: "",
    image: "",
  });

  let currentUser$: BehaviorSubject<User | null>;
  let fixture: ComponentFixture<ArticleCommentComponent>;

  const card = (): HTMLElement | null =>
    fixture.nativeElement.querySelector(".card");
  const modOptions = (): HTMLElement | null =>
    fixture.nativeElement.querySelector(".mod-options");

  function create(user: User | null, value: Comment | null = comment): void {
    currentUser$ = new BehaviorSubject<User | null>(user);
    TestBed.configureTestingModule({
      imports: [ArticleCommentComponent],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: { currentUser: currentUser$ } },
      ],
    });
    fixture = TestBed.createComponent(ArticleCommentComponent);
    if (value) {
      fixture.componentRef.setInput("comment", value);
    }
    fixture.detectChanges();
  }

  it("renders nothing when there is no comment", () => {
    create(null, null);

    expect(card()).toBeNull();
  });

  it("renders the comment body, author and date when a comment is set", () => {
    create(null);

    expect(card()).not.toBeNull();
    expect(card()!.querySelector(".card-text")!.textContent!.trim()).toBe(
      "Nice article"
    );
    const authors = card()!.querySelectorAll("a.comment-author");
    expect(authors.length).toBe(2);
    expect(authors[1].textContent!.trim()).toBe("bob");
    expect(authors[1].getAttribute("href")).toBe("/profile/bob");
    expect(
      card()!.querySelector(".comment-author-img")!.getAttribute("src")
    ).toBe("bob.png");
    expect(card()!.querySelector(".date-posted")!.textContent!.trim()).toBe(
      "January 2, 2024"
    );
  });

  it("shows the delete option when the current user wrote the comment", () => {
    create(userNamed("bob"));

    expect(modOptions()).not.toBeNull();
    expect(modOptions()!.querySelector("i.ion-trash-a")).not.toBeNull();
  });

  it("emits delete(true) when the trash icon is clicked", () => {
    create(userNamed("bob"));
    const emitted: boolean[] = [];
    fixture.componentInstance.delete.subscribe((v) => emitted.push(v));

    (modOptions()!.querySelector("i.ion-trash-a") as HTMLElement).click();

    expect(emitted).toEqual([true]);
  });

  it("hides the delete option for another user's comment", () => {
    create(userNamed("alice"));

    expect(card()).not.toBeNull();
    expect(modOptions()).toBeNull();
  });

  it("hides the delete option for anonymous users", () => {
    create(null);

    expect(modOptions()).toBeNull();
  });

  it("toggles the delete option when the current user changes", () => {
    create(null);

    currentUser$.next(userNamed("bob"));
    fixture.detectChanges();
    expect(modOptions()).not.toBeNull();

    currentUser$.next(null);
    fixture.detectChanges();
    expect(modOptions()).toBeNull();
  });
});
