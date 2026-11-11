// Parâmetros oficiais das 3 Propostas do Enunciado (Metalúrgica Alfa)
const LINHAS_FINANCIAMENTO = {
  1: { nome: "1 – Recursos Próprios (100% Capital Próprio)", taxa: 0, prazo: 0, carencia: 0, entradaPct: 1.00, max: Infinity, tipo: "proprio" },
  2: { nome: "2 – Financiamento em 60 parcelas", taxa: 0.0115, prazo: 60, carencia: 0, entradaPct: 0.00, max: Infinity, tipo: "financiamento" },
  3: { nome: "3 – Leasing operacional (10 anos, com opção de compra)", taxa: 0.01, prazo: 120, carencia: 0, entradaPct: 0.00, max: Infinity, tipo: "leasing" }
};

function calcularFinanciamento(idLinha, capex) {
  const linha = LINHAS_FINANCIAMENTO[idLinha] || LINHAS_FINANCIAMENTO[1];
  
  let valorEntrada = 0;
  let valorFinanciado = 0;
  let prestacaoMensal = 0;
  let desembolsoAnual = 0;
  let prazoAnos = linha.prazo > 0 ? Math.ceil(linha.prazo / 12) : 0;

  if (linha.tipo === "proprio") {
    valorEntrada = capex;
    valorFinanciado = 0;
    prestacaoMensal = 0;
    desembolsoAnual = 0;
    prazoAnos = 0;
  } else if (linha.tipo === "financiamento") {
    valorEntrada = capex * linha.entradaPct;
    valorFinanciado = Math.min(capex - valorEntrada, linha.max);
    
    if (linha.prazo > 0 && linha.taxa > 0) {
      const i = linha.taxa;
      const n = linha.prazo - linha.carencia;
      // Sistema Price capitalizado na carência
      prestacaoMensal = (valorFinanciado * Math.pow(1 + i, linha.carencia) * i) / (Math.pow(1 + i, n) - 1);
    }
    desembolsoAnual = prestacaoMensal * 12;

  } else if (linha.tipo === "leasing") {
    // Alternativa 3: Leasing operacional (10 anos / 120 meses com opção de compra)
    valorEntrada = 0; 
    valorFinanciado = capex;
    const i = linha.taxa;
    const n = linha.prazo;
    prestacaoMensal = (valorFinanciado * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1));
    desembolsoAnual = prestacaoMensal * 12;
  }

  return {
    linhaSelecionada: linha,
    valorEntrada,
    valorFinanciado,
    prestacaoMensal,
    desembolsoAnual,
    prazoAnos
  };
}