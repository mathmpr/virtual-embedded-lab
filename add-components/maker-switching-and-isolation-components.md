# Componentes maker de chaveamento e isolação

Baseado em `componentes_maker_para_criancas.md`. Este pacote cobre os componentes ausentes relacionados a transistores, MOSFETs, relés, drivers Darlington e isolação óptica.

## Componentes adicionados

Transistores BJT:

- BC547, BC548, BC337, 2N2222/PN2222A, 2N3904, TIP120, TIP122, TIP41C e BD139 como NPN.
- BC327, 2N3906, TIP125/TIP127, TIP42C e BD140 como PNP.

MOSFETs e módulo de potência:

- IRLZ44N, FQP30N06L, IRF520, AO3400 e 2N7000 como MOSFETs canal N.
- Power MOSFET Module com terminais de alimentação, sinal e carga.

Relés, SSRs e drivers:

- Módulos de relé eletromecânico de 1, 2, 4 e 8 canais.
- Módulos SSR de 2, 3 e 4 canais.
- ULN2003A e ULN2803A como drivers Darlington para relés/cargas.

Isolação:

- Optoacoplador PC817 com lado LED e lado fototransistor.

Observação: o SSR de 1 canal (`module.relay.ssr.one-channel`) já existia no catálogo em `components/official/solid-state-relay-1ch/component.json`, então não foi duplicado.

## Escopo de simulação

Estes componentes possuem regras elétricas educacionais no kernel. A simulação cobre estados e diagnósticos essenciais para circuitos maker:

- BJT: acionamento de base, resistor de base ausente, emissor sem GND, coletor sem carga, corrente de base insuficiente e limite de corrente de coletor.
- MOSFET canal N: gate flutuante, ausência de pull-down, `Vgs` abaixo do limiar, source sem referência ao GND, dreno sem carga e limite de corrente de dreno.
- Relés/SSR/módulo MOSFET: alimentação VCC/GND, entrada ativa, estado dos canais/contatos e validação de carga, tensão e corrente nominais.
- PC817: corrente do LED interno, resistor de entrada ausente, emissor sem referência, coletor sem pull-up/carga e corrente transferida estimada por CTR.
- ULN2003A/ULN2803A: GND comum, entrada ativa por canal, saída open-collector sem carga e limite de corrente por canal.

O objetivo é detectar erros elétricos comuns e refletir o estado funcional dos componentes no inspector/problemas. Ainda não é uma simulação SPICE/transiente completa.

## Exemplo criado

- `examples/arduino-maker-switching-gallery/project.json`
- Firmware externo: `examples/arduino-maker-switching-gallery/firmware/main.ino`

O exemplo conecta um Arduino UNO a uma seleção de transistores, MOSFET, módulo MOSFET, relés, SSR, PC817 e drivers ULN. O firmware alterna os pinos digitais D2-D11 e escreve no Serial, servindo como cenário visual e de validação de pinagem.

## Extensão visual com LED RGB

Também foi adicionado o componente `electronic.led.rgb.common-cathode` em `components/official/rgb-led-common-cathode/component.json`.

O LED RGB usa três canais PWM independentes (`red`, `green`, `blue`) e um terminal comum-cátodo (`cathode`). O runtime WASM passou a suportar `analogWrite()`, e o solver agrega os valores PWM conectados aos três canais para renderizar a cor final no componente.

Exemplo criado:

- `examples/esp8266-ldr-rgb-daylight/project.json`
- Firmware externo: `examples/esp8266-ldr-rgb-daylight/firmware/main.ino`

O exemplo usa ESP8266 NodeMCU, LDR, controle de ambiente `Light Environment`, resistores de 220 Ω e LED RGB comum-cátodo. Ao alterar a luminosidade do ambiente, o firmware lê o LDR e muda a cor do LED em uma escala contínua: claro em vermelho, passando por laranja, amarelo e verde, até azul no escuro.
