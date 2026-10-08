import { redirect } from "next/navigation";

/** Old link: the shared sign-in screen with "Staff" preselected. */
export default function TeamLogin() {
  redirect("/login?as=staff");
}
