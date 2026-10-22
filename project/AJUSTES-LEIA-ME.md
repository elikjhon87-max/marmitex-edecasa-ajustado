# Marmitex É De CASA — ajustes aplicados

## O que foi alterado

1. **Portal do entregador:** o botão “Entregue” fica bloqueado enquanto a retirada não for confirmada pelo PIN.
2. **Conclusão sem duplicidade:** a conclusão agora chama a função SQL `complete_delivery_order`, que valida o pedido e realiza a mudança de status, o crédito da carteira e o lançamento financeiro dentro de uma única transação. Uma segunda tentativa não gera outro crédito.
3. **Aceitar pedido:** a atualização é condicional para que dois entregadores não aceitem o mesmo pedido ao mesmo tempo; cliques repetidos são bloqueados enquanto a ação está em andamento.
4. **Disponibilidade do parceiro:** foi adicionada no separador “Conta” do portal do entregador a opção de ficar disponível/indisponível.
5. **Configurações:** campos de texto recebem valores vazios seguros quando o banco devolve `null` e o formulário preserva os valores anteriores quando a configuração é atualizada.
6. **Diagnóstico:** a falha ao carregar `business_config` agora é registrada no console.
7. **Segredos:** o `.env` original não foi incluído. Use `.env.example` como modelo e configure as variáveis no Bolt.

## Obrigatório antes de testar

### 1. Aplicar a migração no Supabase

No painel Supabase, abra **SQL Editor**, crie uma consulta e execute o conteúdo completo do arquivo:

`supabase/migrations/20261022_driver_availability_and_safe_completion.sql`

Essa migração cria a coluna `available_for_jobs` e a função SQL usada para concluir a entrega com segurança. Sem ela, a disponibilidade e a conclusão segura apresentarão erro.

### 2. Configurar variáveis de ambiente

Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas variáveis de ambiente do projeto Bolt. Os valores de exemplo em `.env.example` são marcadores, não credenciais reais.

### 3. Segurança da chave Stripe

O ZIP recebido continha uma variável `STRIPE_SECRET_KEY` com uma chave de teste. Ela foi removida deste pacote. Por precaução, revogue essa chave no painel Stripe e gere outra. Nunca exponha uma chave secreta Stripe em código frontend ou variável `VITE_*`; use-a somente em função de servidor/Edge Function.

## Importante sobre disponibilidade

O botão salva a disponibilidade do parceiro no banco. Para que a loja consiga filtrar e mostrar “entregadores disponíveis perto”, ainda é necessário conectar esse estado à tela administrativa/fluxo de atribuição e definir como a região será calculada (bairro/região ou localização consentida). Esta alteração não ativa rastreamento GPS em segundo plano.

## Validação

O ambiente desta execução não conseguiu concluir a instalação de dependências (`npm ci` expirou), então não foi possível executar o build nem o typecheck aqui. Depois de importar no Bolt e aplicar a migração, execute o build e verifique os erros do terminal antes de publicar.
