function calcularPaybackDescontado(fluxoLiquido, investimentoInicial, tma) {
  let fluxoDescontado = Array(26).fill(0);
  let acumuladoDescontado = Array(26).fill(0);

  fluxoDescontado[0] = -investimentoInicial;
  acumuladoDescontado[0] = -investimentoInicial;

  let pbDescontado = null;

  for (let ano = 1; ano <= 25; ano++) {
    fluxoDescontado[ano] = fluxoLiquido[ano] / Math.pow(1 + tma, ano);
    acumuladoDescontado[ano] = acumuladoDescontado[ano - 1] + fluxoDescontado[ano];

    if (acumuladoDescontado[ano] >= 0 && pbDescontado === null) {
      const fracao = (0 - acumuladoDescontado[ano - 1]) / fluxoDescontado[ano];
      pbDescontado = (ano - 1) + fracao;
    }
  }

  const vpl = acumuladoDescontado[25];
  const tir = calcularTIR(fluxoLiquido);

  return { fluxoDescontado, acumuladoDescontado, vpl, tir, pbDescontado };
}

function calcularTIR(fluxos, palpite = 0.1) {
  // Se não houver investimento inicial negativo, a TIR não é aplicável
  if (!fluxos || fluxos[0] >= 0) return null; 

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
  return null; // Retorna null se não convergir
}