"""Gera imagens de teste SINTÉTICAS para a Etapa 1 (importação e pré-visualização).

Estas imagens NÃO são ECGs reais nem contêm dados de pacientes. Os ECGs sintéticos
usados para validar a extração do traçado serão gerados na Etapa 3.
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "samples"
OUT.mkdir(exist_ok=True)


def paper(width, height, label):
    image = Image.new("RGB", (width, height), (255, 246, 246))
    draw = ImageDraw.Draw(image)
    for x in range(0, width, 10):
        draw.line([(x, 0), (x, height)], fill=(247, 205, 205) if x % 50 else (236, 150, 150), width=1)
    for y in range(0, height, 10):
        draw.line([(0, y), (width, y)], fill=(247, 205, 205) if y % 50 else (236, 150, 150), width=1)
    draw.rectangle((20, 20, 620, 64), fill=(255, 255, 255))
    draw.text((30, 34), label, fill=(20, 20, 20))
    return image


paper(1800, 900, "IMAGEM SINTETICA DE TESTE - grade milimetrada (nao e um ECG)").save(OUT / "teste-grade-1800x900.png")
paper(640, 360, "IMAGEM SINTETICA - baixa resolucao").save(OUT / "teste-baixa-resolucao.jpg", quality=88)
paper(900, 1700, "IMAGEM SINTETICA - vertical").save(OUT / "teste-vertical.webp", quality=85)
(OUT / "invalido-corrompido.png").write_bytes(b"isto nao e uma imagem png valida")
(OUT / "invalido-formato.txt").write_text("arquivo de texto usado para testar a rejeicao de formato\n")
print("gerado:", ", ".join(sorted(p.name for p in OUT.iterdir())))
