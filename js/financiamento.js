// Parâmetros oficiais das 4 Linhas de Financiamento
const LINHAS_FINANCIAMENTO = {
  1: { nome: "Linha 1 – Crédito Eficiência Energética", taxa: 0.0098, prazo: 72, carencia: 6, entradaPct: 0.20, max: 3000000, tipo: "financiamento" },
  2: { nome: "Linha 2 – Energia Renovável Empresarial", taxa: 0.0115, prazo: 60, carencia: 3, entradaPct: 0.10, max: 5000000, tipo: "financiamento" },
  3: { nome: "Linha 3 – Cooperativa de Crédito Solar", taxa: 0.0085, prazo: 84, carencia: 12, entradaPct: 0.15, max: 2500000, tipo: "financiamento" },
  4: { nome: "Linha 4 – Leasing Empresarial (BTS)", taxa: 0.01, prazo: 120, carencia: 0, entradaPct: 0.00, max: Infinity, tipo: "leasing" }
};

function calcularFinanciamento(idLinha, capex) {
  const linha = LINHAS_FINANCIAMENTO[idLinha] || LINHAS_FINANCIAMENTO[3];
  
  let valorEntrada = 0;
  let valorFinanciado = 0;
  let prestacaoMensal = 0;
  let desembolsoAnual = 0;
  let prazoAnos = Math.ceil(linha.prazo / 12);

  if (linha.tipo === "financiamento") {
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
    // Linha 4: Leasing BTS (Sem entrada, parcela fixa mensal, opção de compra ao final)
    valorEntrada = 0; 
    valorFinanciado = capex;
    // Parcela fixa estimada baseada no CAPEX dividido pelo prazo (ou taxa contratual de BTS)
    prestacaoMensal = (capex * (linha.taxa + (1 / linha.prazo))); 
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