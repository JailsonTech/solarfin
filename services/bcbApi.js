// Serviço responsável por buscar indicadores macroeconômicos oficiais (Banco Central do Brasil - SGS)
const BcbApi = {
  async buscarUltimosValores(serieId, quantidade) {
    try {
      const response = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serieId}/dados/ultimos/${quantidade}?formato=json`);
      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error(`Erro ao buscar série ${serieId} do BCB:`, error);
      return [];
    }
  },

  async obterIndicesAtualizados() {
    // Busca os últimos 12 registros da série 433 (IPCA mensal) e o último da série 432 (Selic anual)
    const [dadosIpcaMensal, dadosSelic] = await Promise.all([
      this.buscarUltimosValores(433, 12),
      this.buscarUltimosValores(432, 1)
    ]);

    // 1. Acumula o IPCA dos últimos 12 meses compostos: Fator = (1 + m1) * (1 + m2) * ... - 1
    let ipcaAnualAcumulado = null;
    if (dadosIpcaMensal && dadosIpcaMensal.length > 0) {
      let fatorAcumulado = 1;
      dadosIpcaMensal.forEach(item => {
        const taxaMensal = parseFloat(item.valor) / 100;
        fatorAcumulado *= (1 + taxaMensal);
      });
      ipcaAnualAcumulado = (fatorAcumulado - 1) * 100;
    }

    // 2. Pega a Selic anual vigente
    let selicAnual = null;
    if (dadosSelic && dadosSelic.length > 0) {
      selicAnual = parseFloat(dadosSelic[0].valor);
    }

    return {
      ipca: ipcaAnualAcumulado !== null ? ipcaAnualAcumulado.toFixed(2).replace('.', ',') : null,
      tma: selicAnual !== null ? selicAnual.toFixed(2).replace('.', ',') : null
    };
  }
};
