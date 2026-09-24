import { redirect } from "next/navigation";

// Brand management starts with assets (phase 1, T7); identity and CRUD arrive in T9 and T10.
export default function BrandsPage() {
  redirect("/brands/assets");
}
