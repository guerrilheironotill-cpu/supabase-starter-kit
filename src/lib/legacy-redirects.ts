const LEGACY_REDIRECTS: Record<string, string> = {
  "/produto/vaso-de-planta-toquio-120cm": "/produto/vaso-toquio",
  "/produto/vaso-cilindrico-malabo": "/produto/vaso-malabo",
  "/produto/vaso-daka-3": "/produto/vaso-daka",
  "/produto/vaso-bali-florianopolis": "/produto/vaso-bali",
  "/produto/mesa-lateral-de-concreto-e-metal":
    "/produto/mesa-lateral-de-concreto-e-metal-arteno-design-industrial-moderno",
  "/produto/vaso-florenca": "/produto/jardineira-florenca-2",
  "/produto/mesa-roma": "/produto/mesa-de-concreto-roma",
  "/produto/vaso-roma-2": "/produto/vaso-roma",
  "/produto/cubo-de-cimento-40cmx40cm": "/produto/mesa-cubo-de-cimento",
  "/produto/vaso-atenas-2": "/produto/vaso-atenas",
  "/produto/vaso-atenas-xg-l60cm-x-h100cm": "/produto/vaso-atenas",
  "/produto/banqueta-de-bar-35x80cm": "/produto/banqueta-verona",
  "/produto/banco-industrial-toronto-madeira-metal": "/categoria/bancos",
  "/acabamentos": "/catalogo",
  "/texturas": "/catalogo",
  "/promocoes": "/catalogo",
  "/tabela-de-produtos": "/catalogo",
  "/teste-tabela-dinamica-bricks": "/catalogo",
  "/carrinho": "/orcamento",
  "/finalizar-compra": "/orcamento",
  "/minha-conta": "/auth",
  "/vasos-redondos-ou-quadrados-qual-a-melhor-opcao-para-seu-ambiente":
    "/categoria/vasos-de-concreto",
  "/acabamento/cimento-queimado-grafite": "/catalogo",
  "/acabamento/cimento-queimado-natural": "/catalogo",
  "/acabamento/areia": "/catalogo",
  "/acabamento/tons-da-terra-rosa": "/catalogo",
  "/acabamento/cimento-queimado-preto": "/catalogo",
};

function normalizedPath(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

export function legacyRedirectFor(url: URL): URL | null {
  const destination = LEGACY_REDIRECTS[normalizedPath(url.pathname)];
  if (!destination) return null;
  const redirect = new URL(destination, url);
  if (process.env.APP_ENV === "production") {
    redirect.protocol = "https:";
    redirect.hostname = "arteno.com.br";
    redirect.port = "";
  }
  redirect.search = url.search;
  return redirect;
}

export function canonicalHostRedirectFor(url: URL): URL | null {
  if (process.env.APP_ENV !== "production") return null;
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "www.arteno.com.br" && hostname !== "novo.arteno.com.br") return null;
  const redirect = new URL(url);
  redirect.protocol = "https:";
  redirect.hostname = "arteno.com.br";
  redirect.port = "";
  return redirect;
}
