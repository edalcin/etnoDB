# Próximos Passos — BioCultDB

> **Documento de estado desta unidade.** Registra onde o BioCultDB está e o que falta fazer. Ponto de entrada de qualquer nova sessão de trabalho — humana ou assistida por IA.
>
> Pendência de arquitetura da federação **não** mora aqui: mora em [`Arquitetura-BioCultural/docs/proximosPassos.md`](https://github.com/edalcin/Arquitetura-BioCultural/blob/main/docs/proximosPassos.md), que é a referência única do projeto. Aqui ficam só as pendências desta unidade.
>
> **Regras de manutenção:** ao final de cada sessão, atualizar a data, o estado e a lista de pendências. Pendência resolvida não é apagada: é marcada como feita, com o `onde`. Caminhos são relativos à raiz deste repositório.

**Estado em:** 2026-08-30

---

## 1. Estado

**Em produção** desde julho de 2026, como unidade dual-app (BioCultDB + BioCultTermos sobre um único arquivo SQLite+JSON1), em três interfaces: Aquisição (3001), Curadoria (3002), Apresentação (3003), mais o admin do BioCultTermos (4001, HTTP Basic).

Implementados: extração de metadados de PDF por IA (ADR-002, absorveu o BioCultPapers), agregação por conceito SKOS-XL no painel analítico (ADR-003), etnoChat, e a integração do BioCultTermos como submodule.

É a **unidade de referência** da arquitetura: o que funciona aqui é o que as demais unidades copiam.

## 2. Pendências

| # | Pendência | Origem / bloqueio |
|---|---|---|
| 1 | **Campos de acesso do ADR-003 da arquitetura** (`visibility`, `restrictions`, `permissions`) nunca foram materializados no banco de produção | Arquitetura §6; sem eles não há como cumprir o contrato de harvest |
| 2 | **29 registros existentes sem valor de `regime`** — preenchimento é trivial (`evidencia` para todos, correto por construção da unidade), mas ainda não foi feito | ADR-015 da arquitetura (K1), estado *Proposto* |
| 3 | **Endpoint de harvest** (`GET /api/federation/records`, paginado, com redação na fronteira) não implementado | ADR-016 da arquitetura; consumidor é o Pluriverso, que também não existe ainda |
| 4 | **Qualidade da extração por IA não medida** com PDFs reais — risco registrado na própria ADR-002 e nunca quantificado | ADR-002 (Aceito, implementado) |
| 5 | **Generalizar o `AcquisitionService`** do BioCultTermos para aceitar lista de pares `{tabela, campos[]}` — hoje é específico do BioCultDB e bloqueia Relatos, Acervos e Naturalistas | `integracao.md`; é pendência **desta** unidade porque o código vive aqui |

## 3. Onde está cada coisa

| Artefato | Caminho |
|---|---|
| Checklist e resultado da integração BioCultTermos | `integracao.md` |
| Decisões desta unidade | `docs/decisions/` |
| Runbook do corte de produção (Unraid) | `docs/operacao/corte-producao-unidade.md` |
| Glossário local | `CONTEXT.md` |
| Referência única do projeto | <https://github.com/edalcin/Arquitetura-BioCultural/blob/main/docs/proximosPassos.md> |
