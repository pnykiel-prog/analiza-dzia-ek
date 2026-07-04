import { redirect } from "next/navigation";

/**
 * Wejście do aplikacji = od razu ekran startowy „Nowa analiza działki" (ciemny).
 * Bez strony marketingowej — kierujemy prosto na /nowa.
 */
export default function Home() {
  redirect("/nowa");
}
