import Link from "next/link";
import Image from "next/image";
import {
  FaYoutube,
  FaInstagram,
  FaFacebookF,
  FaEnvelope,
} from "react-icons/fa";


export default function Footer() {
  return (
    <footer className="w-full bg-foreground text-background">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">
        
        {/* Logo / About */}
        <div className="space-y-4">
                      <div className="flex items-center">
              <Link href="/">
                <Image
                  src="/images/redevoce.png"
                  width={110}
                  height={110}
                  alt="Rede Você"
                  className="brightness-110"
                  priority
                />
              </Link>
            </div>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Comunicação Sem Limites.
          </p>
        </div>

        {/* Address */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Endereço</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Rua Princesa Isabel, 155 <br />
            Vila Mocó – Petrolina, PE <br />
            CEP 56304-510
          </p>
        </div>

        {/* Contact & Social */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Contato</h3>

          <Link
            href="mailto:contato@redevc.com.br"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-background transition-colors"
            title="Enviar e-mail"
          >
            <FaEnvelope className="w-4 h-4" />
            contato@redevc.com.br
          </Link>

          <div className="flex items-center gap-5 pt-2">
            <Link
              href="#"
              aria-label="YouTube"
              title="YouTube"
              className="hover:text-red-500 transition-colors"
            >
              <FaYoutube className="w-5 h-5" />
            </Link>

            <Link
              href="#"
              aria-label="Instagram"
              title="Instagram"
              className="hover:text-pink-500 transition-colors"
            >
              <FaInstagram className="w-5 h-5" />
            </Link>

            <Link
              href="#"
              aria-label="Facebook"
              title="Facebook"
              className="hover:text-blue-500 transition-colors"
            >
              <FaFacebookF className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-border text-center py-4 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Rede Você. Todos os direitos reservados.
      </div>
    </footer>
  );
}
