function calcularPaybackSimples(fluxoLiquido, investimentoInicial) {
  let fluxoAcumulado = Array(26).fill(0);
  fluxoAcumulado[0] = -investimentoInicial;
  
  let pbSimples = null;

  for (let ano = 1; ano <= 25; ano++) {
    fluxoAcumulado[ano] = fluxoAcumulado[ano - 1] + fluxoLiquido[ano];

    if (fluxoAcumulado[ano] >= 0 && pbSimples === null) {
      const fracao = (0 - fluxoAcumulado[ano - 1]) / fluxoLiquido[ano];
      pbSimples = (ano - 1) + fracao;
    }
  }

  return { fluxoAcumulado, pbSimples };
}