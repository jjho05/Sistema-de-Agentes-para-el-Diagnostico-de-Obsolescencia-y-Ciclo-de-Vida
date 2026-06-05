# Usar imagen base oficial de Python
FROM python:3.9-slim

# Crear usuario con ID 1000 para cumplir con los requisitos de Hugging Face Spaces
RUN useradd -m -u 1000 user

# Configurar directorio de trabajo en la casa del usuario
ENV HOME=/home/user
WORKDIR $HOME/app

# Instalar dependencias de compilación para ChromaDB, SentenceTransformers y descarga/unzip
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements primero para aprovechar el caché de Docker
COPY --chown=user requirements.txt .

# Instalar dependencias de Python
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copiar el resto de los archivos del proyecto con los permisos correctos
COPY --chown=user . .

# Descargar el dataset de manuales de iFixit (rub-ksv/MyFixit-Dataset)
RUN curl -L https://github.com/rub-ksv/MyFixit-Dataset/archive/refs/heads/master.zip -o master.zip \
    && unzip master.zip \
    && rm master.zip

# Descargar el dataset de Babbitt et al. usando nuestro script
RUN python3 download_real_data.py

# Construir la base de datos vectorial ChromaDB a partir de los datos descargados
RUN python3 parse_real_babbitt.py

# Limpiar los datasets crudos descargados para mantener la imagen ligera y cumplir
# con la cuota de espacio en Hugging Face
RUN rm -rf MyFixit-Dataset-master raw_data

# Pre-descargar el modelo de embeddings de Hugging Face durante el build
# para evitar descargas al iniciar la aplicación, acelerando el arranque.
RUN python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Configurar variables de entorno y exponer el puerto 7860
ENV PORT=7860
EXPOSE 7860

# Comando para iniciar el backend que también sirve el frontend de SADOC
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
