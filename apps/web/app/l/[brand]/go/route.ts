import { whatsappLink, whatsappMessage } from "@radev/core";
import { getBrandLink, getBrandNetworkPost, listBrandLinks, recordLinkEvent } from "@radev/db";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withRef } from "@/lib/links";
import { DEFAULT_WHATSAPP_MESSAGE, getLinksPageBrand, referrerHost } from "@/lib/links-page";

// A tap on a brand's links page (phase 6 T5): records it (which post, which link; nothing
// personal) and sends the visitor on. `?post=<id>` opens WhatsApp with the post's reference, or
// the primary link with `?ref=` when the brand has no WhatsApp; `?to=whatsapp` a plain chat;
// `?link=<id>` one of the brand's links. Ids are checked to be the brand's.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: RouteContext<"/l/[brand]/go">) {
  const brand = await getLinksPageBrand((await params).brand);
  if (!brand) return new NextResponse("No existe.", { status: 404 });
  const query = request.nextUrl.searchParams;
  const referrer = referrerHost(request.headers.get("referer"));
  const back = NextResponse.redirect(new URL(`/l/${brand.slug}`, request.url), 303);

  const postId = query.get("post");
  if (postId) {
    const post = await getBrandNetworkPost(db, { brandId: brand.id, id: postId });
    if (!post) return back;
    if (brand.whatsappNumber) {
      const template = brand.whatsappMessageTemplate ?? DEFAULT_WHATSAPP_MESSAGE;
      await recordLinkEvent(db, {
        brandId: brand.id,
        kind: "whatsapp",
        networkPostId: post.id,
        referrer,
      });
      return NextResponse.redirect(
        whatsappLink(brand.whatsappNumber, whatsappMessage(template, post.ref)),
        303,
      );
    }
    const primary = (await listBrandLinks(db, brand.id)).find(
      (link) => link.primary && link.active,
    );
    if (!primary) return back;
    await recordLinkEvent(db, {
      brandId: brand.id,
      kind: "link",
      networkPostId: post.id,
      linkId: primary.id,
      referrer,
    });
    return NextResponse.redirect(withRef(primary.url, post.ref), 303);
  }

  if (query.get("to") === "whatsapp" && brand.whatsappNumber) {
    await recordLinkEvent(db, { brandId: brand.id, kind: "whatsapp", referrer });
    return NextResponse.redirect(whatsappLink(brand.whatsappNumber), 303);
  }

  const linkId = query.get("link");
  if (linkId) {
    const link = await getBrandLink(db, { brandId: brand.id, id: linkId });
    if (!link?.active) return back;
    await recordLinkEvent(db, { brandId: brand.id, kind: "link", linkId: link.id, referrer });
    return NextResponse.redirect(link.url, 303);
  }
  return back;
}
