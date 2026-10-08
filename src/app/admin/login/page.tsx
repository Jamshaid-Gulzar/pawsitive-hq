import { redirect } from "next/navigation";

/** Old link: the shared sign-in screen with "Admin" preselected. */
export default function AdminLogin() {
  redirect("/login?as=admin");
}
