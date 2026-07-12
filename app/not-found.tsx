import ErrorState from "@/components/ErrorState";
import WeddingShell from "@/components/WeddingShell";

export default function NotFound() {
  return <WeddingShell screen>
    <ErrorState title="Link jest nieprawidłowy" description="Otwórz link otrzymany od pary młodej." />
  </WeddingShell>;
}
