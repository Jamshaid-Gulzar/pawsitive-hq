import { redirect } from "next/navigation";

/** Everyone signs in on the same screen. */
export default function Home() {
  redirect("/login");
}
