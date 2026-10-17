// Confere o leitor de páginas de produto do "Colar link" (supabase/functions/ler-link/parse.ts).
// Uso: npx tsx scripts/check-link.ts
import { blocked, decode, num, parse, storeOf, useful } from '../supabase/functions/ler-link/parse';

let ok = 0, bad = 0;
const check = (cond: boolean, msg: string) => { if (cond) { ok++; console.log('  ok    ', msg); } else { bad++; console.log('  FALHOU', msg); } };

console.log('Colar link');
check(num('R$ 1.299,90') === 1299.9 && num('1299.90') === 1299.9 && num(899) === 899 && num('1.299') === 1299 && num('') === null, 'preços em vários formatos');
check(decode('Panela &amp; Tampa &#8211; 5 pe&ccedil;as') === 'Panela & Tampa – 5 peças', 'decodifica entidades');
check(storeOf('https://www.magazineluiza.com.br/x/p/1') === 'Magalu' && storeOf('https://produto.mercadolivre.com.br/MLB-1') === 'Mercado Livre', 'lojas conhecidas');
check(storeOf('https://www.lojinha.com.br/p', 'Lojinha da Ana') === 'Lojinha da Ana' && storeOf('https://www.lojinha.com.br/p') === 'Lojinha', 'nome do site e domínio');

{
  const html = `<html><head><title>Ignorar</title>
    <meta property="og:title" content="Geladeira OG">
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList"},
      {"@type":"Product","name":"Geladeira Brastemp Frost Free 375L","image":["/img/g.jpg"],
       "offers":{"@type":"Offer","priceCurrency":"BRL","price":"3499.90"}}]}</script></head></html>`;
  const r = parse(html, 'https://www.magazineluiza.com.br/geladeira/p/123/');
  check(r.title === 'Geladeira Brastemp Frost Free 375L', 'nome do JSON-LD (dentro de @graph)');
  check(r.price === 3499.9, 'preço do JSON-LD');
  check(r.image === 'https://www.magazineluiza.com.br/img/g.jpg', 'foto relativa vira endereço completo');
  check(r.store === 'Magalu', 'loja');
}
{
  const html = `<meta content="Sofá Retrátil &amp; Reclinável" property="og:title" />
    <meta property='og:image' content='https://cdn.loja.com/sofa.jpg'>
    <meta property="product:price:amount" content="2.799,00"><meta property="product:price:currency" content="BRL">
    <meta property="og:site_name" content="Casa Linda">`;
  const r = parse(html, 'https://casalinda.com.br/sofa');
  check(r.title === 'Sofá Retrátil & Reclinável' && r.price === 2799 && r.image === 'https://cdn.loja.com/sofa.jpg' && r.store === 'Casa Linda', 'só meta tags (atributos fora de ordem e aspas simples)');
}
{
  const html = `<script type="application/ld+json">{"@type":"Product","name":"Mesa","offers":[{"priceCurrency":"USD","price":"100"},{"priceCurrency":"BRL","lowPrice":"450"}]}</script>`;
  check(parse(html, 'https://x.com.br/m').price === 450, 'ignora preço em dólar e usa lowPrice em real');
}
{
  const html = `<script type="application/ld+json">{ quebrado </script><title>Robot Check</title>`;
  const r = parse(html, 'https://www.amazon.com.br/dp/B0');
  check(r.title === 'Robot Check' && r.price === null && r.store === 'Amazon', 'JSON quebrado não derruba (página de bloqueio só tem o título)');
  check(blocked(r) && !blocked({ ...r, title: 'Panela de pressão' }), 'reconhece página de bloqueio');
}

{
  const html = `<title>Zelda: Tears of the Kingdom - Nintendo Switch 2 | Amazon.com.br</title>
    <link rel="canonical" href="https://www.amazon.com.br/Zelda/dp/B0F6DDZMZY" />
    <img id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/61Cu.jpg" src="x.jpg">
    <span class="a-price"><span class="a-offscreen">R$&nbsp;499,90</span></span>`;
  const r = parse(html, 'https://www.amazon.com.br/dp/B0F6DDZMZY?ref=cm_sw&social_share=x');
  check(r.title === 'Zelda: Tears of the Kingdom - Nintendo Switch 2', 'Amazon: tira " | Amazon.com.br" do nome');
  check(r.image === 'https://m.media-amazon.com/images/I/61Cu.jpg' && r.price === 499.9, 'Amazon: foto (data-old-hires) e preço (a-offscreen)');
  check(r.url === 'https://www.amazon.com.br/Zelda/dp/B0F6DDZMZY', 'usa o link canônico');
}
{
  const html = `<link rel="canonical" href="https://www.kabum.com.br/produto/519934/false"><meta property="og:title" content="Headset">`;
  check(parse(html, 'https://www.kabum.com.br/produto/519934/headset?utm_source=x&cor=preto').url === 'https://www.kabum.com.br/produto/519934/headset?cor=preto', 'canônico quebrado: usa o endereço sem rastreio');
}
check(blocked({ title: 'Magazine Luiza | Não é possível acessar a página', image: '', price: null, store: 'Magalu', url: '' }), 'reconhece o bloqueio do Magalu');
check(!useful({ title: 'Mercado Libre', image: '', price: null, store: 'Mercado Livre', url: '' })
  && useful({ title: 'Sofá', image: 'https://x/s.jpg', price: null, store: 'Mobly', url: '' })
  && useful({ title: 'Sofá', image: '', price: 10, store: 'Mobly', url: '' }), 'só título (página genérica) não serve; foto ou preço sim');

console.log(`\n${ok} ok, ${bad} falharam`);
if (bad) process.exit(1);
