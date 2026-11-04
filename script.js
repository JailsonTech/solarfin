let chartFC = null;
let chartComp = null;

document.getElementById('calcForm').addEventListener('submit', function(e) {
  e.preventDefault();
  calcularViabilidade();
});

function fmtR$(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(val) {
  return val.toFixed(2).replace('.', ',') + '%';
}

function calcularViabilidade() {
  // Ler valores das entradas
  const capex = parseFloat(document.getElementById('capex').value);
  const geracaoInicial = parseFloat(document.getElementById('geracaoAnual').value);
  const tarifaInicial = parseFloat(document.getElementById('tarifaInicial').value);
  const opexInicial = parseFloat(document.getElementById('opexInicial').value);
  const tma = parseFloat(document.getElementById('tma').value) / 100;
  const reajusteTarifa = parseFloat(document.getElementById('reajusteTarifa').value) / 100;
  const ipca = parseFloat(document.getElementById('ipca').value) / 100;
  const degradacao = parseFloat(document.getElementById('degradacao').value) / 100;
  const pctTrocaInv = parseFloat(document.getElementById('trocaInversor').value) / 100;
  const modalidade = document.getElementById('modalidade').value;

  // Calcular parcelas anuais de financiamento para simplificação do modelo de 25 anos
  let investimentoInicial = capex;
  let parcelasAnuais = Array(26).fill(0);

  if (modalidade === 'linha1') { // 72 meses (6 anos), 0,98% a.m., 20% entrada
    const entrada = capex * 0.20;
    investimentoInicial = entrada;
    const valorFinanc = capex * 0.80;
    const i = 0.0098;
    const pmtMensal = valorFinanc * (i * Math.pow(1 + i, 72)) / (Math.pow(1 + i, 72) - 1);
    for (let a = 1; a <= 6; a++) parcelasAnuais[a] = pmtMensal * 12;
  } else if (modalidade === 'linha2') { // 60 meses (5 anos), 1,15% a.m., 10% entrada
    const entrada = capex * 0.10;
    investimentoInicial = entrada;
    const valorFinanc = capex * 0.90;
    const i = 0.0115;
    const pmtMensal = valorFinanc * (i * Math.pow(1 + i, 60)) / (Math.pow(1 + i, 60) - 1);
    for (let a = 1; a <= 5; a++) parcelasAnuais[a] = pmtMensal * 12;
  } else if (modalidade === 'linha3') { // 84 meses (7 anos), 0,85% a.m., 15% entrada
    const entrada = capex * 0.15;
    investimentoInicial = entrada;
    const valorFinanc = capex * 0.85;
    const i = 0.0085;
    const pmtMensal = valorFinanc * (i * Math.pow(1 + i, 84)) / (Math.pow(1 + i, 84) - 1);
    for (let a = 1; a <= 7; a++) parcelasAnuais[a] = pmtMensal * 12;
  } else if (modalidade === 'leasing') { // 120 meses (10 anos), 0% entrada, residual 5%
    investimentoInicial = 0;
    // Estimativa de leasing equivalente
    const pmtMensal = (capex * 1.45) / 120;
    for (let a = 1; a <= 10; a++) parcelasAnuais[a] = pmtMensal * 12;
    parcelasAnuais[10] += capex * 0.05; // compra residual
  }

  // Vetores de fluxo de caixa
  let economiaEnergia = Array(26).fill(0);
  let opex = Array(26).fill(0);
  let trocaInversor = Array(26).fill(0);
  let fluxoLiquido = Array(26).fill(0);
  let fluxoAcumulado = Array(26).fill(0);
  let fluxoDescontado = Array(26).fill(0);
  let acumuladoDescontado = Array(26).fill(0);

  // Ano 0
  fluxoLiquido[0] = -investimentoInicial;
  fluxoAcumulado[0] = -investimentoInicial;
  fluxoDescontado[0] = -investimentoInicial;
  acumuladoDescontado[0] = -investimentoInicial;

  let pbSimples = null;
  let pbDescontado = null;

  for (let ano = 1; ano <= 25; ano++) {
    // Geracao degradada
    const geracaoAno = geracaoInicial * Math.pow(1 - degradacao, ano - 1);
    // Tarifa reajustada
    const tarifaAno = tarifaInicial * Math.pow(1 + reajusteTarifa, ano - 1);
    economiaEnergia[ano] = geracaoAno * tarifaAno;

    // OPEX corrigido IPCA
    opex[ano] = opexInicial * Math.pow(1 + ipca, ano - 1);

    // Troca de inversor no ano 12
    if (ano === 12) {
      trocaInversor[ano] = capex * pctTrocaInv * Math.pow(1 + ipca, ano - 1);
    }

    // Fluxo Líquido
    fluxoLiquido[ano] = economiaEnergia[ano] - opex[ano] - trocaInversor[ano] - parcelasAnuais[ano];
    fluxoAcumulado[ano] = fluxoAcumulado[ano - 1] + fluxoLiquido[ano];

    // Fluxo Descontado
    fluxoDescontado[ano] = fluxoLiquido[ano] / Math.pow(1 + tma, ano);
    acumuladoDescontado[ano] = acumuladoDescontado[ano - 1] + fluxoDescontado[ano];

    // Paybacks
    if (fluxoAcumulado[ano] >= 0 && pbSimples === null) {
      const fracao = (0 - fluxoAcumulado[ano - 1]) / fluxoLiquido[ano];
      pbSimples = (ano - 1) + fracao;
    }
    if (acumuladoDescontado[ano] >= 0 && pbDescontado === null) {
      const fracao = (0 - acumuladoDescontado[ano - 1]) / fluxoDescontado[ano];
      pbDescontado = (ano - 1) + fracao;
    }
  }

  // Cálculo VPL
  const vpl = acumuladoDescontado[25];

  // Cálculo TIR
  const tir = calcularTIR(fluxoLiquido);

  // Atualizar Tela
  document.getElementById('resultadosSection').classList.remove('d-none');
  
  document.getElementById('vplVal').innerText = fmtR$(vpl);
  document.getElementById('vplSub').innerText = vpl > 0 ? "Projeto Altamente Viável (VPL > 0)" : "Projeto Inviável (VPL < 0)";
  document.getElementById('tirVal').innerText = fmtPct(tir * 100);
  document.getElementById('tirSub').innerText = tir > tma ? `Acima da TMA (${fmtPct(tma * 100)})` : `Abaixo da TMA (${fmtPct(tma * 100)})`;
  document.getElementById('pbDescVal').innerText = pbDescontado ? `${pbDescontado.toFixed(1)} anos` : '> 25 anos';
  document.getElementById('pbSimplesVal').innerText = pbSimples ? `${pbSimples.toFixed(1)} anos` : '> 25 anos';

  // Preencher Tabela
  const tbody = document.querySelector('#tabelaFC tbody');
  tbody.innerHTML = '';
  
  for (let ano = 0; ano <= 25; ano++) {
    const tr = document.createElement('tr');
    if (ano === 0) {
      tr.innerHTML = `
        <td><b>Ano 0</b></td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>${fmtR$(investimentoInicial)}</td>
        <td class="text-danger fw-bold">${fmtR$(fluxoLiquido[0])}</td>
        <td class="text-danger fw-bold">${fmtR$(fluxoAcumulado[0])}</td>
        <td class="text-danger">${fmtR$(fluxoDescontado[0])}</td>
        <td class="text-danger">${fmtR$(acumuladoDescontado[0])}</td>
      `;
    } else {
      tr.innerHTML = `
        <td>Ano ${ano}</td>
        <td class="text-success">${fmtR$(economiaEnergia[ano])}</td>
        <td class="text-danger">${fmtR$(opex[ano])}</td>
        <td>${trocaInversor[ano] > 0 ? fmtR$(trocaInversor[ano]) : '-'}</td>
        <td>${parcelasAnuais[ano] > 0 ? fmtR$(parcelasAnuais[ano]) : '-'}</td>
        <td class="${fluxoLiquido[ano] >= 0 ? 'text-success' : 'text-danger'} fw-bold">${fmtR$(fluxoLiquido[ano])}</td>
        <td class="${fluxoAcumulado[ano] >= 0 ? 'text-success' : 'text-danger'}">${fmtR$(fluxoAcumulado[ano])}</td>
        <td>${fmtR$(fluxoDescontado[ano])}</td>
        <td class="${acumuladoDescontado[ano] >= 0 ? 'text-success' : 'text-danger'}">${fmtR$(acumuladoDescontado[ano])}</td>
      `;
    }
    tbody.appendChild(tr);
  }

  // Atualizar Parecer
  const parecerContainer = document.getElementById('parecerTexto');
  let parecerHtml = `
    <p><b>Recomendação Final:</b> <span class="badge bg-${vpl > 0 ? 'success' : 'danger'} fs-6">${vpl > 0 ? 'RECOMENDADA A IMPLANTAÇÃO' : 'NÃO RECOMENDADO'}</span></p>
    <p>A análise econômico-financeira para o projeto de <b>750,20 kWp</b> da Metalúrgica Alfa indica que o empreendimento apresenta <b>Valor Presente Líquido (VPL) de ${fmtR$(vpl)}</b> e uma <b>Taxa Interna de Retorno (TIR) de ${fmtPct(tir * 100)}</b>.</p>
    <ul>
      <li><b>Retorno do Investimento:</b> O Payback Descontado é atingido em <b>${pbDescontado ? pbDescontado.toFixed(1) : 'mais de 25'} anos</b>.</li>
      <li><b>Comparação com Mercado:</b> A TIR de ${fmtPct(tir * 100)} superou a Taxa Mínima de Atratividade (TMA) estipulada em ${fmtPct(tma * 100)}.</li>
      <li><b>Modalidade Selecionada:</b> A alternativa de financiamento/investimento selecionada exige um desembolso inicial de <b>${fmtR$(investimentoInicial)}</b>.</li>
    </ul>
    <p><b>Conclusão da Consultoria:</b> O projeto fotovoltaico protege a Metalúrgica Alfa contra a inflação energética histórica (média de ${fmtPct(reajusteTarifa * 100)} a.a.) e gera excedente de caixa consistente, justificando a aprovação junto à diretoria.</p>
  `;
  parecerContainer.innerHTML = parecerHtml;

  // Renderizar Gráficos
  renderizarGraficos(fluxoAcumulado, acumuladoDescontado, economiaEnergia, opex, parcelasAnuais);
}

// Algoritmo de Newton-Raphson para cálculo da TIR
function calcularTIR(fluxos, palpite = 0.1) {
  let rate = palpite;
  for (let i = 0; i < 1000; i++) {
    let npv = 0;
    let dNpv = 0;
    for (let t = 0; t < fluxos.length; t++) {
      npv += fluxos[t] / Math.pow(1 + rate, t);
      dNpv -= (t * fluxos[t]) / Math.pow(1 + rate, t + 1);
    }
    const newRate = rate - npv / dNpv;
    if (Math.abs(newRate - rate) < 1e-6) return newRate;
    rate = newRate;
  }
  return rate;
}

function renderizarGraficos(acumulado, acumuladoDesc, economia, opex, financiamento) {
  const anosLabels = Array.from({length: 26}, (_, i) => `Ano ${i}`);

  // Destruir gráficos anteriores se existirem
  if (chartFC) chartFC.destroy();
  if (chartComp) chartComp.destroy();

  // Gráfico 1: Fluxo Acumulado
  const ctx1 = document.getElementById('chartFC').getContext('2d');
  chartFC = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: anosLabels,
      datasets: [
        {
          label: 'Acumulado Simples (R$)',
          data: acumulado,
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13, 110, 253, 0.1)',
          fill: true,
          tension: 0.2
        },
        {
          label: 'Acumulado Descontado (TMA) (R$)',
          data: acumuladoDesc,
          borderColor: '#198754',
          borderDash: [5, 5],
          fill: false,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        y: {
          ticks: {
            callback: function(value) {
              return 'R$ ' + (value / 1000).toFixed(0) + 'k';
            }
          }
        }
      }
    }
  });

  // Gráfico 2: Composição Ano 5
  const anoRef = 5;
  const ctx2 = document.getElementById('chartComp').getContext('2d');
  chartComp = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: ['Economia de Energia', 'Custos OPEX', 'Parcelas Financiamento'],
      datasets: [{
        label: `Valores no Ano ${anoRef} (R$)`,
        data: [economia[anoRef], opex[anoRef], financiamento[anoRef]],
        backgroundColor: ['#198754', '#dc3545', '#ffc107']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}