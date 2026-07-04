import { redirect } from "next/navigation";

/**
 * Wejście do aplikacji = ekran wprowadzenia (dwa kafle: treść o analizie + formularz
 * z przełącznikiem TERYT/identyfikator). Kierujemy od razu na /nowa, żeby po wejściu
 * użytkownik od razu mógł podać działkę. Działki przykładowe są dostępne jako
 * „Przykłady" w formularzu (tryb Kaskada TERYT).
 */
export default function Home() {
  redirect("/nowa");
}
