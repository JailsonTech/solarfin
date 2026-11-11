// --- DASHBOARD SCRIPT ---

let chartFC = null;
let chartComp = null;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('calcForm');
  const linhaSelect = document.getElementById('linhaFinanciamentoSelect');
  const paybackSelect = document.getElementById('tipoPaybackSelect');
  const btnExportar = document.getElementById('btnExportarExcel');
  const btnBaixarTabela = document.getElementById('btnBaixarExcelTabela');

  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      executarSimulacao();
    });
  }

  if (linhaSelect) {
    linhaSelect.addEventListener('change', executarSimulacao);
  }
  if (paybackSelect) {
    paybackSelect.addEventListener('change', executarSimulacao);
  }

  if (btnExportar) {
    btnExportar.addEventListener('click', exportarPlanilhaMultiaabas);
  }
  if (btnBaixarTabela) {
    btnBaixarTabela.addEventListener('click', exportarPlanilhaMultiaabas);
  }

  document.querySelectorAll('.decimal-mask').forEach(input => {
    input.addEventListener('input', function(e) {
      let valor = e.target.value.replace(/\D/g, "");
      if (valor === "") {
        e.target.value = "";
        return;
      }
      let numero = parseFloat(valor) / 100;
      e.target.value = numero.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    });
  });

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
  const capexEl = document.getElementById('capex');
  const economiaEl = document.getElementById('economiaInicial');
  const opexEl = document.getElementById('opexInicial');
  const tmaEl = document.getElementById('tma');
  const reajusteEl = document.getElementById('reajusteTarifa');
  const ipcaEl = document.getElementById('ipca');

  const capex = parsePtBr(capexEl ? capexEl.value : 0);
  const economiaInicial = parsePtBr(economiaEl ? economiaEl.value : 0);
  const opexInicial = parsePtBr(opexEl ? opexEl.value : 0);
  const tma = parsePtBr(tmaEl ? tmaEl.value : 0) / 100;
  const reajusteTarifa = parsePtBr(reajusteEl ? reajusteEl.value : 0) / 100;
  const ipca = parsePtBr(ipcaEl ? ipcaEl.value : 0) / 100;

  const linhaSelectEl = document.getElementById('linhaFinanciamentoSelect');
  const paybackSelectEl = document.getElementById('tipoPaybackSelect');

  const idLinha = linhaSelectEl ? linhaSelectEl.value : '1';
  const tipoFocoPayback = paybackSelectEl ? paybackSelectEl.value : 'descontado';

  const financiamento = calcularFinanciamento(idLinha, capex);
  
  // Para fins de análise de payback do projeto, utiliza-se o CAPEX total do ativo
  // independentemente se houve entrada ou financiamento de 100%
  const investimentoInicial = capex; 

  let economiaEnergia = Array(26).fill(0);
  let opex = Array(26).fill(0);
  let fluxoLiquido = Array(26).fill(0);

  fluxoLiquido[0] = -investimentoInicial;

  for (let ano = 1; ano <= 25; ano++) {
    economiaEnergia[ano] = economiaInicial * Math.pow(1 + reajusteTarifa, ano - 1);
    opex[ano] = opexInicial * Math.pow(1 + ipca, ano - 1);
    let parcelaAnoCorrente = (ano <= financiamento.prazoAnos) ? financiamento.desembolsoAnual : 0;
    fluxoLiquido[ano] = economiaEnergia[ano] - opex[ano] - parcelaAnoCorrente;
  }

  const resSimples = calcularPaybackSimples(fluxoLiquido, investimentoInicial);
  const resDescontado = calcularPaybackDescontado(fluxoLiquido, investimentoInicial, tma);

  const resultadosSec = document.getElementById('resultadosSection');
  if (resultadosSec) resultadosSec.classList.remove('d-none');

  const vplValEl = document.getElementById('vplVal');
  const vplSubEl = document.getElementById('vplSub');
  if (vplValEl) vplValEl.innerText = fmtR$(resDescontado.vpl);
  if (vplSubEl) vplSubEl.innerText = resDescontado.vpl > 0 ? "Projeto Viável (VPL > 0)" : "Inviável (VPL < 0)";
  
  const tirValEl = document.getElementById('tirVal');
  const tirSubEl = document.getElementById('tirSub');
  if (resDescontado.tir !== null && !isNaN(resDescontado.tir)) {
    if (tirValEl) tirValEl.innerText = fmtPct(resDescontado.tir * 100);
    if (tirSubEl) tirSubEl.innerText = resDescontado.tir > tma ? `Acima da TMA (${fmtPct(tma * 100)})` : `Abaixo da TMA`;
  } else {
    if (tirValEl) tirValEl.innerText = "N/A";
    if (tirSubEl) tirSubEl.innerText = "Inaplicável";
  }

  const pbDescValEl = document.getElementById('pbDescVal');
  const pbSimplesValEl = document.getElementById('pbSimplesVal');
  if (pbDescValEl) pbDescValEl.innerText = resDescontado.pbDescontado ? `${resDescontado.pbDescontado.toFixed(1)} anos` : '> 25 anos';
  if (pbSimplesValEl) pbSimplesValEl.innerText = resSimples.pbSimples ? `${resSimples.pbSimples.toFixed(1)} anos` : '> 25 anos';

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

  const theadTr = document.getElementById('tabelaCabecalho');
  const tituloTabela = document.getElementById('tabelaTitulo');
  const tbody = document.querySelector('#tabelaFC tbody');
  if (tbody) tbody.innerHTML = '';

  if (tipoFocoPayback === 'simples') {
    if (tituloTabela) tituloTabela.innerHTML = `<i class="bi bi-table text-primary me-2"></i> Tabela Detalhada - Foco em Payback Simples (Nominal)`;
    if (theadTr) {
      theadTr.innerHTML = `
        <th>Ano</th>
        <th>Economia de Energia</th>
        <th>OPEX</th>
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
          <td>-</td><td>-</td><td>-</td>
          <td class="text-danger fw-bold">${fmtR$(fluxoLiquido[0])}</td>
          <td class="text-danger fw-bold">${fmtR$(resSimples.fluxoAcumulado[0])}</td>
        `;
      } else {
        tr.innerHTML = `
          <td><b>Ano 0</b></td>
          <td>-</td><td>-</td><td>-</td>
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
          <td class="text-danger">${parcelaExibida}</td>
          <td class="${fluxoLiquido[ano] >= 0 ? 'text-success' : 'text-danger'} fw-bold">${fmtR$(fluxoLiquido[ano])}</td>
          <td class="${resSimples.fluxoAcumulado[ano] >= 0 ? 'text-success' : 'text-danger'} fw-bold">${fmtR$(resSimples.fluxoAcumulado[ano])}</td>
        `;
      } else {
        tr.innerHTML = `
          <td>Ano ${ano}</td>
          <td class="text-success">${fmtR$(economiaEnergia[ano])}</td>
          <td class="text-danger">${fmtR$(opex[ano])}</td>
          <td class="text-danger">${parcelaExibida}</td>
          <td class="${fluxoLiquido[ano] >= 0 ? 'text-success' : 'text-danger'} fw-bold">${fmtR$(fluxoLiquido[ano])}</td>
          <td>${fmtR$(resDescontado.fluxoDescontado[ano])}</td>
          <td class="${resDescontado.acumuladoDescontado[ano] >= 0 ? 'text-success' : 'text-danger'} fw-bold">${fmtR$(resDescontado.acumuladoDescontado[ano])}</td>
        `;
      }
    }
    if (tbody) tbody.appendChild(tr);
  }

  let textoPaybackFoco = tipoFocoPayback === 'simples' 
    ? `<b>Payback Simples (Foco da Análise):</b> Retorno nominal em <b>${resSimples.pbSimples ? resSimples.pbSimples.toFixed(1) + ' anos' : '> 25 anos'}</b>.`
    : `<b>Payback Descontado (Foco da Análise):</b> Retorno descontado a TMA em <b>${resDescontado.pbDescontado ? resDescontado.pbDescontado.toFixed(1) + ' anos' : '> 25 anos'}</b>.`;

  let trechoTirParecer = (resDescontado.tir !== null && !isNaN(resDescontado.tir))
    ? `com uma TIR de <b>${fmtPct(resDescontado.tir * 100)}</b> ao ano.`
    : `sendo a TIR <b>inaplicável</b>.`;

  const parecerTextoEl = document.getElementById('parecerTexto');
  if (parecerTextoEl) {
    parecerTextoEl.innerHTML = `
      <p><b>Modalidade Selecionada:</b> <span class="badge bg-primary fs-6">${financiamento.linhaSelecionada.nome}</span></p>
      <ul>
        <li>Desembolso Inicial (Entrada): <b>${fmtR$(financiamento.valorEntrada)}</b> | Valor Financiado/Leasing: <b>${fmtR$(financiamento.valorFinanciado)}</b></li>
        <li>Prazo: <b>${financiamento.linhaSelecionada.prazo} meses</b> | Parcela Estimada: <b>${fmtR$(financiamento.prestacaoMensal)}/mês</b></li>
      </ul>
      <p><b>Recomendação Final:</b> <span class="badge bg-${resDescontado.vpl > 0 ? 'success' : 'danger'} fs-6">${resDescontado.vpl > 0 ? 'RECOMENDADA A IMPLANTAÇÃO' : 'NÃO RECOMENDADO'}</span></p>
      <p>O VPL calculado é de <b>${fmtR$(resDescontado.vpl)}</b> ${trechoTirParecer}</p>
      <p>${textoPaybackFoco}</p>
    `;
  }

  renderizarGraficos(resSimples.fluxoAcumulado, resDescontado.acumuladoDescontado, economiaEnergia, opex);
}

function exportarPlanilhaMultiaabas() {
  const capexVal = document.getElementById('capex');
  const economiaVal = document.getElementById('economiaInicial');
  const opexVal = document.getElementById('opexInicial');
  const tmaValEl = document.getElementById('tma');
  const reajusteValEl = document.getElementById('reajusteTarifa');
  const ipcaValEl = document.getElementById('ipca');

  const capex = parsePtBr(capexVal ? capexVal.value : 0);
  const economiaInicial = parsePtBr(economiaVal ? economiaVal.value : 0);
  const opexInicial = parsePtBr(opexVal ? opexVal.value : 0);
  const tmaVal = tmaValEl ? tmaValEl.value : '0';
  const reajusteVal = reajusteValEl ? reajusteValEl.value : '0';
  const ipcaVal = ipcaValEl ? ipcaValEl.value : '0';

  const tma = parsePtBr(tmaVal) / 100;
  const reajusteTarifa = parsePtBr(reajusteVal) / 100;
  const ipca = parsePtBr(ipcaVal) / 100;

  const tipoFocoPaybackEl = document.getElementById('tipoPaybackSelect');
  const tipoFocoPayback = tipoFocoPaybackEl ? tipoFocoPaybackEl.value : 'descontado';
  
  const wb = XLSX.utils.book_new();
  const idsLinhas = [1, 2, 3]; 

  idsLinhas.forEach(idLinha => {
    const financiamento = calcularFinanciamento(idLinha, capex);
    const investimentoInicial = Number(capex.toFixed(2));

    let economiaEnergia = Array(26).fill(0);
    let opex = Array(26).fill(0);
    let fluxoLiquido = Array(26).fill(0);
    fluxoLiquido[0] = Number((-investimentoInicial).toFixed(2));

    for (let ano = 1; ano <= 25; ano++) {
      economiaEnergia[ano] = Number((economiaInicial * Math.pow(1 + reajusteTarifa, ano - 1)).toFixed(2));
      opex[ano] = Number((opexInicial * Math.pow(1 + ipca, ano - 1)).toFixed(2));
      let parcelaAnoCorrente = (ano <= financiamento.prazoAnos) ? Number(financiamento.desembolsoAnual.toFixed(2)) : 0;
      fluxoLiquido[ano] = Number((economiaEnergia[ano] - opex[ano] - parcelaAnoCorrente).toFixed(2));
    }

    const resSimples = calcularPaybackSimples(fluxoLiquido, investimentoInicial);
    const resDescontado = calcularPaybackDescontado(fluxoLiquido, investimentoInicial, tma);

    const vplFormatado = resDescontado.vpl.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const statusVpl = resDescontado.vpl > 0 ? "Projeto Viável (VPL > 0)" : "Inviável (VPL < 0)";
    
    const tirFormatada = (resDescontado.tir !== null && !isNaN(resDescontado.tir)) 
      ? (resDescontado.tir * 100).toFixed(2).replace('.', ',') + '%' 
      : "Inaplicável";
    const statusTir = (resDescontado.tir !== null && !isNaN(resDescontado.tir)) 
      ? (resDescontado.tir > tma ? `Acima da TMA (${tmaVal}%)` : `Abaixo da TMA`) 
      : "Inaplicável";

    const pbDescFormatado = resDescontado.pbDescontado ? resDescontado.pbDescontado.toFixed(1).replace('.', ',') + ' anos' : '> 25 anos';
    const pbSimplesFormatado = resSimples.pbSimples ? resSimples.pbSimples.toFixed(1).replace('.', ',') + ' anos' : '> 25 anos';

    const recomendacaoTexto = resDescontado.vpl > 0 ? "RECOMENDADA A IMPLANTAÇÃO" : "NÃO RECOMENDADO";
    const tirTextoFormatada = (resDescontado.tir !== null && !isNaN(resDescontado.tir)) ? `${(resDescontado.tir * 100).toFixed(2).replace('.', ',')}% ao ano` : "inaplicável";
    const paybackDescTexto = resDescontado.pbDescontado ? `${resDescontado.pbDescontado.toFixed(1).replace('.', ',')} anos` : '> 25 anos';

    let wsData = [
      ["RELATÓRIO DE VIABILIDADE - METALÚRGICA ALFA"],
      [`Modalidade:  ${financiamento.linhaSelecionada.nome}`],
      [`Prazo: ${financiamento.linhaSelecionada.prazo} meses | Taxa: ${(financiamento.linhaSelecionada.taxa * 100).toFixed(2)}% a.m.`],
      [`Foco de Análise:  ${tipoFocoPayback === 'simples' ? "Payback Simples (Nominal)" : "Payback Descontado (TMA)"}`],
      [],
      ["--- PARECER TÉCNICO FINANCEIRO ---"],
      ["Desembolso Inicial (Entrada):", Number(financiamento.valorEntrada.toFixed(2))],
      ["Prazo da Linha:", `${financiamento.linhaSelecionada.prazo} meses`],
      ["Valor Financiado/Leasing:", Number(financiamento.valorFinanciado.toFixed(2))],
      ["Parcela Estimada:", Number(financiamento.prestacaoMensal.toFixed(2))],
      ["Recomendação Final:", recomendacaoTexto],
      ["Análise de Retorno:", `O VPL calculado é de ${vplFormatado}, com uma TIR de ${tirTextoFormatada}.`],
      ["Payback (Foco):", `Retorno descontado a TMA em ${paybackDescTexto}.`],
      [],
      ["--- PARÂMETROS DE ENTRADA ---"],
      [
        "CAPEX (R$)", 
        "Economia Inicial (R$)", 
        "OPEX Inicial (R$)", 
        "TMA (%)", 
        "Reajuste Tarifário (%)", 
        "IPCA / Inflação (%)"
      ],
      [
        Number(capex.toFixed(2)), 
        Number(economiaInicial.toFixed(2)), 
        Number(opexInicial.toFixed(2)), 
        parsePtBr(tmaVal), 
        parsePtBr(reajusteVal), 
        parsePtBr(ipcaVal)
      ],
      [],
      ["--- RESUMO DOS INDICADORES FINANCEIROS (CARDS) ---"],
      ["Indicador", "Valor Calculado", "Status / Descrição"],
      ["VPL (Valor Presente Líquido)", vplFormatado, statusVpl],
      ["TIR (Taxa Interna de Retorno)", tirFormatada, statusTir],
      ["Payback Descontado", pbDescFormatado, "Considerando o valor do dinheiro no tempo"],
      ["Payback Simples", pbSimplesFormatado, "Retorno nominal direto"],
      [],
      ["--- FLUXO DE DADOS ---"],
      [
        "Ano", 
        "Economia de Energia (R$)", 
        "OPEX (R$)", 
        "Financiamento (R$)", 
        "Fluxo Líquido (R$)", 
        "Fluxo Acumulado Simples (R$)", 
        "Fluxo Descontado (R$)", 
        "Acumulado Descontado (R$)"
      ]
    ];

    for (let ano = 0; ano <= 25; ano++) {
      let parcelaExibida = (ano > 0 && ano <= financiamento.prazoAnos) ? Number(financiamento.desembolsoAnual.toFixed(2)) : 0;
      wsData.push([
        ano === 0 ? "Ano 0" : `Ano ${ano}`,
        ano === 0 ? 0 : Number(economiaEnergia[ano].toFixed(2)),
        ano === 0 ? 0 : Number(opex[ano].toFixed(2)),
        parcelaExibida,
        Number(fluxoLiquido[ano].toFixed(2)),
        Number(resSimples.fluxoAcumulado[ano].toFixed(2)),
        Number(resDescontado.fluxoDescontado[ano].toFixed(2)),
        Number(resDescontado.acumuladoDescontado[ano].toFixed(2))
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = { c: C, r: R };
        const cellRef = XLSX.utils.encode_cell(cellAddress);
        const cell = ws[cellRef];
        if (cell && typeof cell.v === 'number') {
          cell.z = '#,##0.00';
        }
      }
    }

    ws['!cols'] = [
      { wch: 30 }, { wch: 35 }, { wch: 45 }, { wch: 22 }, 
      { wch: 22 }, { wch: 28 }, { wch: 24 }, { wch: 28 }
    ];

    const nomesAbas = {
      1: "Recursos_Proprios",
      2: "Financ_60m",
      3: "Leasing"
    };

    XLSX.utils.book_append_sheet(wb, ws, nomesAbas[idLinha]);
  });

  XLSX.writeFile(wb, "Simulacao_Metalurgica_Alfa_3.xlsx");
}

function renderizarGraficos(acumuladoSimples, acumuladoDesc, economia, opex) {
  const anosLabels = Array.from({length: 26}, (_, i) => `Ano ${i}`);

  if (chartFC) chartFC.destroy();
  if (chartComp) chartComp.destroy();

  const ctx1Elem = document.getElementById('chartFC');
  if (ctx1Elem) {
    const ctx1 = ctx1Elem.getContext('2d');
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
  }

  const anoRef = 5;
  const ctx2Elem = document.getElementById('chartComp');
  if (ctx2Elem) {
    const ctx2 = ctx2Elem.getContext('2d');
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
}