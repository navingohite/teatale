import Link from "next/link";
export default function NotFound() {
  return (
    <div className="narrow">
      <h1>This tale isn’t here.</h1>
      <Link className="button" href="/shop">
        Explore our teas
      </Link>
    </div>
  );
}
