import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Mail } from "../legal-page";

export const metadata: Metadata = { title: "Términos · RAdev Social" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Términos de uso"
      intro={
        <p>
          RAdev Social es una herramienta privada para gestionar las redes de marcas propias. Estos
          términos explican cómo funciona y qué se puede esperar de ella.
        </p>
      }
      sections={[
        {
          title: "Quién la usa",
          body: (
            <p>
              El acceso está limitado al operador del servicio, que entra con una cuenta autorizada.
              No hay registro abierto ni cuentas para terceros.
            </p>
          ),
        },
        {
          title: "Qué hace",
          body: (
            <p>
              Permite preparar carruseles, revisarlos, aprobarlos y programarlos. Solo el contenido
              que el operador aprueba se envía a TikTok, a la cuenta que conectó y con la
              configuración de privacidad e interacción que eligió para cada publicación.
            </p>
          ),
        },
        {
          title: "Responsabilidad sobre el contenido",
          body: (
            <p>
              El operador es responsable del contenido que publica y de cumplir las{" "}
              <a
                href="https://www.tiktok.com/community-guidelines"
                className="text-ink underline underline-offset-4"
              >
                Normas de la comunidad
              </a>{" "}
              y los{" "}
              <a
                href="https://www.tiktok.com/legal/terms-of-service"
                className="text-ink underline underline-offset-4"
              >
                Términos de servicio
              </a>{" "}
              de TikTok, incluida la confirmación de uso de música.
            </p>
          ),
        },
        {
          title: "Disponibilidad",
          body: (
            <p>
              La herramienta se ofrece tal como está. Una publicación puede demorarse o fallar por
              causas ajenas (por ejemplo, límites o cambios de la API de TikTok); en ese caso el
              operador recibe un aviso y puede reintentar.
            </p>
          ),
        },
        {
          title: "Privacidad",
          body: (
            <p>
              El tratamiento de los datos se describe en la{" "}
              <Link href="/legal/privacidad" className="text-ink underline underline-offset-4">
                política de privacidad
              </Link>
              .
            </p>
          ),
        },
        {
          title: "Contacto",
          body: (
            <p>
              Consultas sobre estos términos: <Mail />.
            </p>
          ),
        },
      ]}
      english={{
        title: "Terms of use (English)",
        sections: [
          {
            title: "Summary",
            body: (
              <>
                <p>
                  RAdev Social is a private tool for managing the social accounts of the operator's
                  own brands. Access is limited to the operator; there is no public sign-up.
                </p>
                <p>
                  Only content the operator approves is sent to TikTok, to the account they
                  connected, with the privacy and interaction settings they chose for each post. The
                  operator is responsible for the content and for complying with TikTok's Community
                  Guidelines and Terms of Service, including the Music Usage Confirmation.
                </p>
                <p>
                  The tool is provided as is; a post may be delayed or fail for external reasons, in
                  which case the operator is notified. Contact: <Mail />.
                </p>
              </>
            ),
          },
        ],
      }}
    />
  );
}
