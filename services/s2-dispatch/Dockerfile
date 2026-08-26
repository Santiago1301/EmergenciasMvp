# Build desde la RAIZ del monorepo:
#   docker build -f services/s2-dispatch/Dockerfile -t s2-dispatch .

FROM public.ecr.aws/lambda/python:3.12 AS build
WORKDIR /build
COPY libs/emergencias_common ./libs/emergencias_common
COPY services/s2-dispatch/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --target /opt/python && \
    pip install --no-cache-dir ./libs/emergencias_common --target /opt/python

FROM public.ecr.aws/lambda/python:3.12
COPY --from=build /opt/python ${LAMBDA_TASK_ROOT}
COPY services/s2-dispatch/app ${LAMBDA_TASK_ROOT}/app
CMD ["app.main.handler"]
