# Build desde la RAIZ del monorepo:
#   docker build -f services/s1-intake/Dockerfile -t s1-intake .
# (necesita ver libs/emergencias_common, por eso el contexto no es esta carpeta)

FROM public.ecr.aws/lambda/python:3.12 AS build
WORKDIR /build
COPY libs/emergencias_common ./libs/emergencias_common
COPY services/s1-intake/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --target /opt/python && \
    pip install --no-cache-dir ./libs/emergencias_common --target /opt/python

FROM public.ecr.aws/lambda/python:3.12
COPY --from=build /opt/python ${LAMBDA_TASK_ROOT}
COPY services/s1-intake/app ${LAMBDA_TASK_ROOT}/app
CMD ["app.main.handler"]
