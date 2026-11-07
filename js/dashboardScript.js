let chartFC = null;
let chartComp = null;

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('calcForm');
  const linhaSelect = document.getElementById('linhaFinanciamentoSelect');
  const paybackSelect = document.getElementById('tipoPaybackSelect');
  const btnExportar = document.getElementById('btnExportarExcel');

  // 1. CARREGAMENTO AUTOMÁTICO DOS ÍNDICES DA API DO BANCO CENTRAL (services/bcbApi.js)
  if (typeof BcbApi !== 'undefined') {
    try {
      const indices = await BcbApi.obterIndicesAtualizados();
      if (indices.ipca) {
        const inputIpca = document.getElementById('ipca');
        if (inputIpca) inputIpca.value = indices.ipca;
      }
      if (indices.tma) {
        const inputTma = document.getElementById('tma');
        if (inputTma) inputTma.value = indices.tma;
      }
    } catch (e) {
      console.warn("Não foi possível carregar os dados automáticos da API do BCB. Mantendo padrões.", e);
    }
  }

  // 2. Dispara o cálculo ao enviar o formulário
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      executarSimulacao();
    });
  }

  // --- REATIVIDADE AUTOMÁTICA DOS SELECTS ---
  if (linhaSelect) {
    linhaSelect.addEventListener('change', executarSimulacao);
  }
  if (paybackSelect) {
    paybackSelect.addEventListener('change', executarSimulacao);
  }

  // --- BOTÃO DE EXPORTAÇÃO PARA O EXCEL (ABA ÚNICA) ---
  if (btnExportar) {
    btnExportar.addEventListener('click', exportarPlanilhaUnica);
  }

  // Máscaras de input numéricas
  document.querySelectorAll('.decimal-mask').forEach(input => {
    input.addEventListener('input', function(e) {
      let val = e.target.value.replace(/[^\d,\.]/g, '');
      e.target.value = val;
    });
  });

  // Executa o cálculo inicial automaticamente ao carregar a página com os dados preenchidos
  executarSimulacao();
});

function fmtR$(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(val) {
  return val.toFixed(2).replace('.', ',') + '%';
}

function parsePtBr(valorStr) {
  if (!valorStr) return 0;
  let limpo = valorStr.toString().replace(/\./g, '').replace(',', '.');
  return parseFloat(limpo) || 0;
}

function executarSimulacao() {
  const capex = parsePtBr(document.getElementById('capex')?.value);
  const geracaoInicial = parsePtBr(document.getElementById('geracaoAnual')?.value);
  const tarifaInicial = parsePtBr(document.getElementById('tarifaInicial')?.value);
  const opexInicial = parsePtBr(document.getElementById('opexInicial')?.value);
  const tma = parsePtBr(document.getElementById('tma')?.value) / 100;
  const reajusteTarifa = parsePtBr(document.getElementById('reajusteTarifa')?.value) / 100;
  const ipca = parsePtBr(document.getElementById('ipca')?.value) / 100;
  const degradacao = parsePtBr(document.getElementById('degradacao')?.value) / 100;
  const pctTrocaInv = parsePtBr(document.getElementById('trocaInversor')?.value) / 100;

  // 1. Captura as escolhas dos dois selects
  const idLinha = document.getElementById('linhaFinanciamentoSelect')?.value || '3';
  const tipoFocoPayback = document.getElementById('tipoPaybackSelect')?.value || 'descontado';

  // 2. Processa o financiamento da linha escolhida via módulo dedicado (financiamento.js)
  const financiamento = calcularFinanciamento(idLinha, capex);
  const investimentoInicial = financiamento.valorEntrada; // Se for Leasing (Linha 4), entrada é 0

  let economiaEnergia = Array(26).fill(0);
  let opex = Array(26).fill(0);
  let trocaInversor = Array(26).fill(0);
  let fluxoLiquido = Array(26).fill(0);

  fluxoLiquido[0] = -investimentoInicial;

  for (let ano = 1; ano <= 25; ano++) {
    const geracaoAno = geracaoInicial * Math.pow(1 - degradacao, ano - 1);
    const tarifaAno = tarifaInicial * Math.pow(1 + reajusteTarifa, ano - 1);
    
    economiaEnergia[ano] = geracaoAno * tarifaAno;
    opex[ano] = opexInicial * Math.pow(1 + ipca, ano - 1);

    if (ano === 12) {
      trocaInversor[ano] = capex * pctTrocaInv * Math.pow(1 + ipca, ano - 1);
    }

    // Abate a parcela anual do financiamento durante o prazo da linha
    let parcelaAnoCorrente = (ano <= financiamento.prazoAnos) ? financiamento.desembolsoAnual : 0;

    fluxoLiquido[ano] = economiaEnergia[ano] - opex[ano] - trocaInversor[ano] - parcelaAnoCorrente;
  }

  // 3. Executa os cálculos matemáticos independentes de Payback (Simples e Descontado)
  const resSimples = calcularPaybackSimples(fluxoLiquido, investimentoInicial);
  const resDescontado = calcularPaybackDescontado(fluxoLiquido, investimentoInicial, tma);

  // Exibe a seção de resultados na interface
  document.getElementById('resultadosSection').classList.remove('d-none');

  // 4. Atribuição dos resultados nos cards do dashboard
  document.getElementById('vplVal').innerText = fmtR$(resDescontado.vpl);
  document.getElementById('vplSub').innerText = resDescontado.vpl > 0 ? "Projeto Viável (VPL > 0)" : "Inviável (VPL < 0)";
  
  // Tratamento seguro da TIR (evita NaN% em linhas sem CAPEX próprio, como o Leasing Linha 4)
  if (resDescontado.tir !== null && !isNaN(resDescontado.tir)) {
    document.getElementById('tirVal').innerText = fmtPct(resDescontado.tir * 100);
    document.getElementById('tirSub').innerText = resDescontado.tir > tma ? `Acima da TMA (${fmtPct(tma * 100)})` : `Abaixo da TMA`;
  } else {
    document.getElementById('tirVal').innerText = "N/A";
    document.getElementById('tirSub').innerText = "Inaplicável (Leasing sem Capex Inicial)";
  }

  document.getElementById('pbDescVal').innerText = resDescontado.pbDescontado ? `${resDescontado.pbDescontado.toFixed(1)} anos` : '> 25 anos';
  document.getElementById('pbSimplesVal').innerText = resSimples.pbSimples ? `${resSimples.pbSimples.toFixed(1)} anos` : '> 25 anos';

  // 5. DESTAQUE VISUAL DINÂMICO CONFORME O SELECT DE PAYBACK ESCOLHIDO
  const cardDesc = document.getElementById('cardPbDesc');
  const cardSimples = document.getElementById('cardPbSimples');

  if (cardDesc && cardSimples) {
    cardDesc.classList.remove('border', 'border-warning', 'border-3');
    cardSimples.classList.remove('border', 'border-warning', 'border-3');
    cardDesc.style.opacity = '1';
    cardSimples.style.opacity = '1';

    if (tipoFocoPayback === 'simples') {
      cardSimples.classList.add('border', 'border-warning', 'border-3');
      cardDesc.style.opacity = '0.5';
    } else {
      cardDesc.classList.add('border', 'border-warning', 'border-3');
      cardSimples.style.opacity = '0.5';
    }
  }

  // 6. MONTAGEM DINÂMICA DA TABELA (SEPARADA POR SIMPLES OU DESCONTADO)
  const theadTr = document.getElementById('tabelaCabecalho');
  const tituloTabela = document.getElementById('tabelaTitulo');
  const tbody = document.querySelector('#tabelaFC tbody');
  tbody.innerHTML = '';

  if (tipoFocoPayback === 'simples') {
    if (tituloTabela) tituloTabela.innerHTML = `<i class="bi bi-table text-primary me-2"></i> Tabela Detalhada - Foco em Payback Simples (Nominal)`;
    if (theadTr) {
      theadTr.innerHTML = `
        <th>Ano</th>
        <th>Economia de Energia</th>
        <th>OPEX</th>
        <th>Troca Inversores</th>
        <th>Financiamento</th>
        <th>Fluxo Líquido</th>
        <th>Fluxo Acumulado Simples</th>
      `;
    }
  } else {
    if (tituloTabela) tituloTabela.innerHTML = `<i class="bi bi-table text-primary me-2"></i> Tabela Detalhada - Foco em Payback Descontado (TMA)`;
    if (theadTr) {
      theadTr.innerHTML = `
        <th>Ano</th>
        <th>Economia de Energia</th>
        <th>OPEX</th>
        <th>Troca Inversores</th>
        <th>Financiamento</th>
        <th>Fluxo Líquido</th>
        <th>Fluxo Descontado</th>
        <th>Acumulado Descontado</th>
      `;
    }
  }

  for (let ano = 0; ano <= 25; ano++) {
    const tr = document.createElement('tr');
    let parcelaExibida = (ano > 0 && ano <= financiamento.prazoAnos) ? fmtR$(financiamento.desembolsoAnual) : '-';

    if (ano === 0) {
      if (tipoFocoPayback === 'simples') {
        tr.innerHTML = `
          <td><b>Ano 0</b></td>
          <td>-</td><td>-</td><td>-</td><td>-</td>
          <td class="text-danger fw-bold">${fmtR$(fluxoLiquido[0])}</td>
          <td class="text-danger fw-bold">${fmtR$(resSimples.fluxoAcumulado[0])}</td>
        `;
      } else {
        tr.innerHTML = `
          <td><b>Ano 0</b></td>
          <td>-</td><td>-</td><td>-</td><td>-</td>
          <td class="text-danger fw-bold">${fmtR$(fluxoLiquido[0])}</td>
          <td class="text-danger">${fmtR$(resDescontado.fluxoDescontado[0])}</td>
          <td class="text-danger">${fmtR$(resDescontado.acumuladoDescontado[0])}</td>
        `;
      }
    } else {
      if (tipoFocoPayback === 'simples') {
        tr.innerHTML = `
          <td>Ano ${ano}</td>
          <td class="text-success">${fmtR$(economiaEnergia[ano])}</td>
          <td class="text-danger">${fmtR$(opex[ano])}</td>
          <td>${trocaInversor[ano] > 0 ? fmtR$(trocaInversor[ano]) : '-'}</td>
          <td class="text-danger">${parcelaExibida}</td>
          <td class="${fluxoLiquido[ano] >= 0 ? 'text-success' : 'text-danger'} fw-bold">${fmtR$(fluxoLiquido[ano])}</td>
          <td class="${resSimples.fluxoAcumulado[ano] >= 0 ? 'text-success' : 'text-danger'} fw-bold">${fmtR$(resSimples.fluxoAcumulado[ano])}</td>
        `;
      } else {
        tr.innerHTML = `
          <td>Ano ${ano}</td>
          <td class="text-success">${fmtR$(economiaEnergia[ano])}</td>
          <td class="text-danger">${fmtR$(opex[ano])}</td>
          <td>${trocaInversor[ano] > 0 ? fmtR$(trocaInversor[ano]) : '-'}</td>
          <td class="text-danger">${parcelaExibida}</td>
          <td class="${fluxoLiquido[ano] >= 0 ? 'text-success' : 'text-danger'} fw-bold">${fmtR$(fluxoLiquido[ano])}</td>
          <td>${fmtR$(resDescontado.fluxoDescontado[ano])}</td>
          <td class="${resDescontado.acumuladoDescontado[ano] >= 0 ? 'text-success' : 'text-danger'} fw-bold">${fmtR$(resDescontado.acumuladoDescontado[ano])}</td>
        `;
      }
    }
    tbody.appendChild(tr);
  }

  // 7. Parecer Técnico dinâmico com tratamento seguro para a TIR e o foco de Payback
  let textoPaybackFoco = tipoFocoPayback === 'simples' 
    ? `<b>Payback Simples (Foco da Análise):</b> Retorno nominal em <b>${resSimples.pbSimples ? resSimples.pbSimples.toFixed(1) + ' anos' : '> 25 anos'}</b>.`
    : `<b>Payback Descontado (Foco da Análise):</b> Retorno descontado a TMA em <b>${resDescontado.pbDescontado ? resDescontado.pbDescontado.toFixed(1) + ' anos' : '> 25 anos'}</b>.`;

  let trechoTirParecer = (resDescontado.tir !== null && !isNaN(resDescontado.tir))
    ? `com uma TIR de <b>${fmtPct(resDescontado.tir * 100)}</b> ao ano.`
    : `sendo a TIR <b>inaplicável (modalidade de Leasing sem aporte inicial de capital próprio)</b>.`;

  document.getElementById('parecerTexto').innerHTML = `
    <p><b>Modalidade Selecionada:</b> <span class="badge bg-primary fs-6">${financiamento.linhaSelecionada.nome}</span></p>
    <ul>
      <li>Desembolso Inicial (Entrada): <b>${fmtR$(financiamento.valorEntrada)}</b> | Valor Financiado/Leasing: <b>${fmtR$(financiamento.valorFinanciado)}</b></li>
      <li>Prazo: <b>${financiamento.linhaSelecionada.prazo} meses</b> | Parcela Estimada: <b>${fmtR$(financiamento.prestacaoMensal)}/mês</b></li>
    </ul>
    <p><b>Recomendação Final:</b> <span class="badge bg-${resDescontado.vpl > 0 ? 'success' : 'danger'} fs-6">${resDescontado.vpl > 0 ? 'RECOMENDADA A IMPLANTAÇÃO' : 'NÃO RECOMENDADO'}</span></p>
    <p>O VPL calculado é de <b>${fmtR$(resDescontado.vpl)}</b> ${trechoTirParecer}</p>
    <p>${textoPaybackFoco}</p>
  `;

  renderizarGraficos(resSimples.fluxoAcumulado, resDescontado.acumuladoDescontado, economiaEnergia, opex);
}

// Função para gerar e baixar a planilha Excel em aba única unificada
function exportarPlanilhaUnica() {
  const capex = parsePtBr(document.getElementById('capex')?.value);
  const geracaoInicial = parsePtBr(document.getElementById('geracaoAnual')?.value);
  const tarifaInicial = parsePtBr(document.getElementById('tarifaInicial')?.value);
  const opexInicial = parsePtBr(document.getElementById('opexInicial')?.value);
  const tma = parsePtBr(document.getElementById('tma')?.value) / 100;
  const reajusteTarifa = parsePtBr(document.getElementById('reajusteTarifa')?.value) / 100;
  const ipca = parsePtBr(document.getElementById('ipca')?.value) / 100;
  const degradacao = parsePtBr(document.getElementById('degradacao')?.value) / 100;
  const pctTrocaInv = parsePtBr(document.getElementById('trocaInversor')?.value) / 100;

  const idLinha = document.getElementById('linhaFinanciamentoSelect')?.value || '3';
  const financiamento = calcularFinanciamento(idLinha, capex);
  const investimentoInicial = financiamento.valorEntrada;

  let economiaEnergia = Array(26).fill(0);
  let opex = Array(26).fill(0);
  let trocaInversor = Array(26).fill(0);
  let fluxoLiquido = Array(26).fill(0);
  fluxoLiquido[0] = -investimentoInicial;

  for (let ano = 1; ano <= 25; ano++) {
    const geracaoAno = geracaoInicial * Math.pow(1 - degradacao, ano - 1);
    const tarifaAno = tarifaInicial * Math.pow(1 + reajusteTarifa, ano - 1);
    economiaEnergia[ano] = geracaoAno * tarifaAno;
    opex[ano] = opexInicial * Math.pow(1 + ipca, ano - 1);
    if (ano === 12) {
      trocaInversor[ano] = capex * pctTrocaInv * Math.pow(1 + ipca, ano - 1);
    }
    let parcelaAnoCorrente = (ano <= financiamento.prazoAnos) ? financiamento.desembolsoAnual : 0;
    fluxoLiquido[ano] = economiaEnergia[ano] - opex[ano] - trocaInversor[ano] - parcelaAnoCorrente;
  }

  const resSimples = calcularPaybackSimples(fluxoLiquido, investimentoInicial);
  const resDescontado = calcularPaybackDescontado(fluxoLiquido, investimentoInicial, tma);

  // Montar dados unificados em uma única lista para a planilha
  let dadosUnificados = [];
  for (let ano = 0; ano <= 25; ano++) {
    let parcelaExibida = (ano > 0 && ano <= financiamento.prazoAnos) ? financiamento.desembolsoAnual : 0;
    dadosUnificados.push({
      "Ano": ano === 0 ? "Ano 0" : `Ano ${ano}`,
      "Economia de Energia (R$)": ano === 0 ? 0 : economiaEnergia[ano],
      "OPEX (R$)": ano === 0 ? 0 : opex[ano],
      "Troca Inversores (R$)": trocaInversor[ano] || 0,
      "Financiamento (R$)": parcelaExibida,
      "Fluxo Líquido (R$)": fluxoLiquido[ano],
      "Fluxo Acumulado Simples (R$)": resSimples.fluxoAcumulado[ano],
      "Fluxo Descontado (R$)": resDescontado.fluxoDescontado[ano],
      "Acumulado Descontado (R$)": resDescontado.acumuladoDescontado[ano]
    });
  }

  const wb = XLSX.utils.book_new();
  const wsUnico = XLSX.utils.json_to_sheet(dadosUnificados);

  // Adiciona a aba consolidada
  XLSX.utils.book_append_sheet(wb, wsUnico, "Fluxo_Consolidado");

  // Dispara o download do arquivo .xlsx
  XLSX.writeFile(wb, "Simulacao_Metalurgica_Alfa.xlsx");
}

function renderizarGraficos(acumuladoSimples, acumuladoDesc, economia, opex) {
  const anosLabels = Array.from({length: 26}, (_, i) => `Ano ${i}`);

  if (chartFC) chartFC.destroy();
  if (chartComp) chartComp.destroy();

  const ctx1 = document.getElementById('chartFC').getContext('2d');
  chartFC = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: anosLabels,
      datasets: [
        {
          label: 'Acumulado Simples (R$)',
          data: acumuladoSimples,
          borderColor: '#495057',
          fill: false,
          tension: 0.2
        },
        {
          label: 'Acumulado Descontado (TMA) (R$)',
          data: acumuladoDesc,
          borderColor: '#198754',
          borderDash: [5, 5],
          fill: true,
          backgroundColor: 'rgba(25, 135, 84, 0.1)',
          tension: 0.2
        }
      ]
    },
    options: { responsive: true }
  });

  const anoRef = 5;
  const ctx2 = document.getElementById('chartComp').getContext('2d');
  chartComp = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: ['Economia de Energia', 'Custos OPEX'],
      datasets: [{
        label: `Valores no Ano ${anoRef} (R$)`,
        data: [economia[anoRef], opex[anoRef]],
        backgroundColor: ['#198754', '#dc3545']
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}