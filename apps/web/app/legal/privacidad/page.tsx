import type { Metadata } from "next";
import { LegalPage, Mail } from "../legal-page";

export const metadata: Metadata = { title: "Privacidad · RAdev Social" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de privacidad"
      intro={
        <p>
          RAdev Social es una herramienta de uso personal: la usa un solo operador para preparar,
          programar y publicar carruseles de sus propias marcas en TikTok. No es un servicio abierto
          al público ni tiene usuarios registrados.
        </p>
      }
      sections={[
        {
          title: "Qué datos de TikTok usamos",
          body: (
            <>
              <p>Cuando el operador conecta la cuenta de TikTok de una marca, guardamos:</p>
              <ul>
                <li>el identificador de la cuenta, su nombre visible y su foto de perfil;</li>
                <li>los tokens de acceso que TikTok entrega al autorizar la app;</li>
                <li>
                  el estado de cada publicación enviada (identificador, fecha, resultado y enlace).
                </li>
              </ul>
              <p>
                Solo pedimos los permisos necesarios para leer esos datos básicos y publicar
                contenido en la cuenta conectada. No leemos mensajes, seguidores ni datos de otras
                personas.
              </p>
            </>
          ),
        },
        {
          title: "Para qué los usamos",
          body: (
            <p>
              Únicamente para publicar en la cuenta conectada el contenido que el operador aprobó, a
              la hora que eligió, y para mostrarle en el panel el resultado de cada publicación. No
              usamos los datos para publicidad ni los vendemos.
            </p>
          ),
        },
        {
          title: "Dónde se guardan y cómo se protegen",
          body: (
            <p>
              Los datos viven en un servidor propio (Oracle Cloud) y en copias de seguridad cifradas
              (Backblaze B2). Los tokens se guardan cifrados con AES-256-GCM y nunca se muestran ni
              se registran en los logs. El panel solo es accesible para el operador.
            </p>
          ),
        },
        {
          title: "Con quién se comparten",
          body: (
            <p>
              Con nadie. El contenido de los carruseles se envía a TikTok solo para publicarlo. Los
              proveedores de infraestructura mencionados alojan los datos pero no los usan.
            </p>
          ),
        },
        {
          title: "Cuánto tiempo se guardan y cómo borrarlos",
          body: (
            <p>
              Mientras la cuenta esté conectada. Al desconectarla desde el panel se borran sus
              tokens; también se puede revocar el acceso en cualquier momento desde la app de TikTok
              (Configuración y privacidad → Seguridad → Apps y servicios). Para pedir el borrado
              completo de los datos de una cuenta, escribí a <Mail />.
            </p>
          ),
        },
        {
          title: "Contacto",
          body: (
            <p>
              Por cualquier consulta sobre esta política: <Mail />.
            </p>
          ),
        },
      ]}
      english={{
        title: "Privacy policy (English)",
        sections: [
          {
            title: "Summary",
            body: (
              <>
                <p>
                  RAdev Social is a personal tool used by a single operator to prepare, schedule and
                  publish carousels for their own brands on TikTok. It is not open to the public and
                  has no registered users.
                </p>
                <p>
                  When a brand's TikTok account is connected we store its identifier, display name
                  and avatar, the access tokens issued by TikTok, and the status of each post we
                  send. We only request the permissions needed to read that basic profile and
                  publish content to the connected account.
                </p>
                <p>
                  The data is used only to publish content the operator approved and to show the
                  result in the panel. It is never sold, shared or used for advertising. Tokens are
                  encrypted with AES-256-GCM on our own server (Oracle Cloud) and in encrypted
                  backups (Backblaze B2), and are never logged.
                </p>
                <p>
                  Disconnecting the account in the panel deletes its tokens; access can also be
                  revoked from the TikTok app at any time. To request full deletion, contact{" "}
                  <Mail />.
                </p>
              </>
            ),
          },
        ],
      }}
    />
  );
}
